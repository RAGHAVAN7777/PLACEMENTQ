"""Read-only inference using the original fitted artifacts. Never fits a model."""
import hashlib
import json
from pathlib import Path
import sys

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ['placement_model', 'scaler', 'label_encoders', 'feature_names']
version = hashlib.sha256(b''.join((ROOT / 'models' / f'{name}.joblib').read_bytes() for name in ARTIFACTS)).hexdigest()
model, scaler, encoders, feature_names = [joblib.load(ROOT / 'models' / f'{name}.joblib') for name in ARTIFACTS]
engineered = ['tech_core_score', 'academic_consistency', 'backlog_risk_ratio', 'coding_cgpa_interaction', 'portfolio_strength', 'interview_readiness', 'high_performer_flag', 'zero_backlog_flag']
raw_names = [name for name in feature_names if name not in engineered]

def field_schema(name):
    result = {'key': name, 'label': name.replace('_', ' ').title(), 'required': True}
    if name in encoders:
        return {**result, 'type': 'select', 'options': encoders[name].classes_.tolist()}
    limits = {'age': (15, 100), 'cgpa': (0, 10), 'sleep_hours': (0, 24), 'study_hours_per_day': (0, 24), 'linkedin_connections': (0, 100000), 'github_repos': (0, 10000)}
    low, high = limits.get(name, (0, 100))
    integer = name.endswith('_count') or name in ['age', 'backlogs', 'hackathons_participated', 'github_repos', 'linkedin_connections']
    return {**result, 'type': 'number', 'min': low, 'max': high, 'step': 1 if integer else 0.01, 'integer': integer}

schema = [field_schema(name) for name in raw_names]
def predict_probabilities(rows_list):
    """Vectorized prediction pipeline strictly matching train.py preprocessing."""
    if not rows_list:
        return []
    df = pd.DataFrame([{name: row[name] for name in raw_names} for row in rows_list], columns=raw_names)
    for name, encoder in encoders.items():
        df[name] = encoder.transform(df[name].astype(str))
    df['tech_core_score'] = df.coding_skill_score * .40 + df.aptitude_score * .25 + df.logical_reasoning_score * .20 + df.mock_interview_score * .15
    df['academic_consistency'] = (df.cgpa / 10) * (df.attendance_percentage / 100)
    df['backlog_risk_ratio'] = df.backlogs / (df.attendance_percentage + 1)
    df['coding_cgpa_interaction'] = df.coding_skill_score * df.cgpa
    df['portfolio_strength'] = df.internships_count * 2.5 + df.projects_count * 1.5 + df.hackathons_participated * 1.2 + df.certifications_count * .8 + df.github_repos * .3
    df['interview_readiness'] = df.mock_interview_score * .6 + df.communication_skill_score * .4
    df['high_performer_flag'] = ((df.cgpa >= 8) & (df.coding_skill_score >= 75)).astype(int)
    df['zero_backlog_flag'] = (df.backlogs == 0).astype(int)
    transformed = scaler.transform(df.loc[:, feature_names])
    placed_idx = list(model.classes_).index(1)
    return model.predict_proba(transformed)[:, placed_idx]

REFERENCE_PROFILE = {
    'age': 21,
    'gender': 'Male',
    'cgpa': 7.5,
    'branch': 'CSE',
    'college_tier': 'Tier 2',
    'internships_count': 1,
    'projects_count': 2,
    'certifications_count': 1,
    'coding_skill_score': 65.0,
    'aptitude_score': 65.0,
    'communication_skill_score': 65.0,
    'logical_reasoning_score': 65.0,
    'hackathons_participated': 1,
    'github_repos': 3,
    'linkedin_connections': 250,
    'mock_interview_score': 65.0,
    'attendance_percentage': 80.0,
    'backlogs': 0,
    'extracurricular_score': 60.0,
    'leadership_score': 60.0,
    'volunteer_experience': 'No',
    'sleep_hours': 7.0,
    'study_hours_per_day': 3.0,
}

def explain_profile(values):
    """Ordered model differences from a synthetic reference, not SHAP or causal effects."""
    ref_base = dict(REFERENCE_PROFILE)
    for locked in ['branch', 'gender', 'age', 'college_tier']:
        if locked in values:
            ref_base[locked] = values[locked]

    probs = predict_probabilities([values, ref_base])
    p_student = float(probs[0])
    p_base = float(probs[1])
    # Follow one explicit feature-order path. Each delta is an actual prediction
    # difference; telescoping makes the full waterfall reconcile without scaling.
    eval_rows = [dict(ref_base)]
    keys_list = [k for k in raw_names if k not in ['gender', 'age', 'college_tier', 'branch']]
    running = dict(ref_base)
    for k in keys_list:
        running[k] = values[k]
        eval_rows.append(dict(running))

    pert_probs = predict_probabilities(eval_rows)
    raw_attributions = {}
    for idx, k in enumerate(keys_list):
        delta = float(pert_probs[idx + 1]) - float(pert_probs[idx])
        raw_attributions[k] = delta

    attributions = []
    for k, v in raw_attributions.items():
        label = k.replace('_', ' ').title()
        pct = v * 100
        direction = 'positive' if pct > 0.25 else ('negative' if pct < -0.25 else 'neutral')
        attributions.append({
            'feature': k,
            'label': label,
            'studentValue': values[k],
            'baselineValue': ref_base[k],
            'contributionPct': pct,
            'direction': direction,
        })

    drivers = [a for a in sorted(attributions, key=lambda x: x['contributionPct'], reverse=True) if a['direction'] == 'positive']
    drags = [a for a in sorted(attributions, key=lambda x: x['contributionPct']) if a['direction'] == 'negative']

    waterfall = [{'step': 'Synthetic reference profile', 'value': p_base * 100, 'delta': 0, 'type': 'base'}]
    # Preserve the path order so intermediate bars are actual model predictions.
    top_items = [item for item in attributions if abs(item['contributionPct']) > 1e-12]
    for item in top_items:
        waterfall.append({
            'step': item['label'],
            'delta': item['contributionPct'],
            'type': item['direction'],
            'studentValue': item['studentValue']
        })
    waterfall.append({'step': 'Your Predicted Probability', 'value': p_student * 100, 'delta': 0, 'type': 'total'})

    top_pos_names = [d['label'] for d in drivers[:2]]
    top_neg_names = [d['label'] for d in drags[:2]]
    summary_parts = []
    if top_pos_names:
        summary_parts.append(f"Largest positive model differences on this path: {', '.join(top_pos_names)}.")
    if top_neg_names:
        summary_parts.append(f"Largest negative model differences on this path: {', '.join(top_neg_names)}.")
    if not summary_parts:
        summary_parts.append("The model produces the same estimate along the reference path.")
    summary_parts.append("Contributions depend on feature order and a synthetic reference; they are not SHAP values or causal effects.")

    return {
        'baseProbability': p_base * 100,
        'finalProbability': p_student * 100,
        'method': 'ordered-reference-path-v1',
        'score': round(p_student * 100, 1),
        'predictedClass': 'Placed' if p_student >= 0.5 else 'Not Placed',
        'attributions': sorted(attributions, key=lambda x: abs(x['contributionPct']), reverse=True),
        'topDrivers': drivers[:4],
        'topDrags': drags[:4],
        'waterfall': waterfall,
        'summaryText': ' '.join(summary_parts),
        'modelVersion': version,
        'modelName': type(model).__name__,
    }

ACTIONABLE_LEVERS = [
    {'key': 'coding_skill_score', 'label': 'Coding Skill Score', 'weight': 1.6, 'step': 3.0, 'max': 95.0, 'min': 0.0, 'unit': '/ 100', 'is_int': False},
    {'key': 'mock_interview_score', 'label': 'Mock Interview Score', 'weight': 1.1, 'step': 3.0, 'max': 95.0, 'min': 0.0, 'unit': '/ 100', 'is_int': False},
    {'key': 'aptitude_score', 'label': 'Aptitude Score', 'weight': 1.2, 'step': 2.5, 'max': 92.0, 'min': 0.0, 'unit': '/ 100', 'is_int': False},
    {'key': 'logical_reasoning_score', 'label': 'Logical Reasoning Score', 'weight': 1.2, 'step': 2.5, 'max': 92.0, 'min': 0.0, 'unit': '/ 100', 'is_int': False},
    {'key': 'communication_skill_score', 'label': 'Communication Score', 'weight': 1.0, 'step': 2.5, 'max': 90.0, 'min': 0.0, 'unit': '/ 100', 'is_int': False},
    {'key': 'projects_count', 'label': 'Completed Projects', 'weight': 1.9, 'step': 1.0, 'max': 6.0, 'min': 0.0, 'unit': 'projects', 'is_int': True},
    {'key': 'internships_count', 'label': 'Internships', 'weight': 2.8, 'step': 1.0, 'max': 3.0, 'min': 0.0, 'unit': 'internships', 'is_int': True},
    {'key': 'backlogs', 'label': 'Active Backlogs', 'weight': 2.0, 'step': -1.0, 'max': 0.0, 'min': 0.0, 'unit': 'backlogs', 'is_int': True},
    {'key': 'certifications_count', 'label': 'Certifications', 'weight': 1.2, 'step': 1.0, 'max': 5.0, 'min': 0.0, 'unit': 'certs', 'is_int': True},
    {'key': 'hackathons_participated', 'label': 'Hackathons', 'weight': 1.4, 'step': 1.0, 'max': 5.0, 'min': 0.0, 'unit': 'events', 'is_int': True},
    {'key': 'github_repos', 'label': 'GitHub Repositories', 'weight': 0.8, 'step': 2.0, 'max': 12.0, 'min': 0.0, 'unit': 'repos', 'is_int': True},
]

def solve_counterfactual(values, target_prob):
    """Bounded greedy coordinate search; no guarantee of minimum effort or success."""
    target_prob = min(max(target_prob, 0.05), 0.98)

    current_p = float(predict_probabilities([values])[0])
    current_prof = dict(values)

    if current_p >= target_prob:
        return {
            'targetProbability': round(target_prob * 100, 1),
            'currentProbability': round(current_p * 100, 1),
            'achievedProbability': round(current_p * 100, 1),
            'effortLevel': 'Already Achieved',
            'targetReached': True,
            'recommendedActions': [],
            'optimizedInputs': current_prof,
        }

    best_prof = dict(current_prof)
    best_p = current_p
    max_steps = 40
    step_count = 0

    while best_p < target_prob and step_count < max_steps:
        best_lever = None
        best_gain_roi = 0.0
        best_cand_val = None
        best_cand_p = best_p

        candidates = []
        lever_cands = []
        for lever in ACTIONABLE_LEVERS:
            k = lever['key']
            curr_val = best_prof[k]
            if lever['step'] > 0:
                if curr_val >= lever['max']:
                    continue
                cand_val = min(curr_val + lever['step'], lever['max'])
            else:
                if curr_val <= 0:
                    continue
                cand_val = max(curr_val + lever['step'], 0)

            cand_prof = dict(best_prof)
            cand_prof[k] = int(cand_val) if lever['is_int'] else cand_val
            candidates.append(cand_prof)
            lever_cands.append((lever, cand_prof[k]))

        if not candidates:
            break

        cand_probs = predict_probabilities(candidates)
        for idx, (lever, cand_val) in enumerate(lever_cands):
            p_cand = float(cand_probs[idx])
            gain = p_cand - best_p
            roi = gain / (lever['weight'] + 1e-6)
            if roi > best_gain_roi:
                best_gain_roi = roi
                best_lever = lever
                best_cand_val = cand_val
                best_cand_p = p_cand

        if best_lever is None or best_gain_roi <= 1e-5:
            break

        best_prof[best_lever['key']] = best_cand_val
        best_p = best_cand_p
        step_count += 1

    actions = []
    total_effort = 0.0
    for lever in ACTIONABLE_LEVERS:
        k = lever['key']
        original = values[k]
        target_val = best_prof[k]
        if abs(target_val - original) > 0.05:
            delta = target_val - original
            lever_effort = abs(delta) * lever['weight']
            total_effort += lever_effort

            if k == 'backlogs':
                rationale = f"Model scenario reduces active backlogs from {int(original)} to {int(target_val)}; real outcomes are not guaranteed."
                priority = 'critical'
                diff = 'Medium'
            elif k in ['coding_skill_score', 'mock_interview_score']:
                rationale = f"Boost {lever['label']} by {abs(delta):.0f} points through focused problem-solving."
                priority = 'high' if delta > 10 else 'medium'
                diff = 'High' if delta > 15 else 'Medium'
            elif k in ['internships_count', 'projects_count']:
                rationale = f"Complete {int(abs(delta))} additional verified {lever['unit']}."
                priority = 'high'
                diff = 'High'
            else:
                rationale = f"Improve {lever['label']} from {original:.0f} to {target_val:.0f}."
                priority = 'medium'
                diff = 'Low'

            actions.append({
                'feature': k,
                'label': lever['label'],
                'from': original,
                'to': target_val,
                'delta': round(delta, 1),
                'unit': lever['unit'],
                'rationale': rationale,
                'priority': priority,
                'difficulty': diff,
            })

    effort_level = 'Low' if total_effort < 15 else ('Moderate' if total_effort < 35 else 'High')

    return {
        'targetProbability': round(target_prob * 100, 1),
        'currentProbability': round(current_p * 100, 1),
        'achievedProbability': round(best_p * 100, 1),
        'effortLevel': effort_level,
        'targetReached': best_p >= target_prob,
        'recommendedActions': sorted(actions, key=lambda a: (0 if a['priority'] == 'critical' else 1 if a['priority'] == 'high' else 2)),
        'optimizedInputs': best_prof,
    }

payload = json.load(sys.stdin)
op = payload.get('operation')

if op == 'schema':
    print(json.dumps({'fields': schema, 'featureOrder': feature_names, 'modelVersion': version, 'modelName': type(model).__name__}))
    sys.exit(0)

values = payload.get('inputs', {})
if not isinstance(values, dict):
    print(json.dumps({'errors': {'inputs': 'Baseline inputs must be an object.'}}))
    sys.exit(0)
if 'college_tier' in values:
    val_str = str(values['college_tier']).strip()
    if val_str in ['1', '2', '3']:
        values['college_tier'] = f"Tier {val_str}"
errors = {}
for field in schema:
    key, value = field['key'], values.get(field['key'])
    if field['type'] == 'select':
        if value not in field['options']:
            errors[key] = 'Choose one of the trained categories.'
    elif isinstance(value, bool) or not isinstance(value, (int, float)) or not field['min'] <= value <= field['max'] or (field['integer'] and value != int(value)):
        errors[key] = f"Enter {'a whole number' if field['integer'] else 'a number'} from {field['min']} to {field['max']}."
if errors:
    print(json.dumps({'errors': errors}))
    sys.exit(0)

if op == 'explain':
    print(json.dumps(explain_profile(values)))
    sys.exit(0)

if op == 'counterfactual':
    target = payload.get('targetProbability', 0.85)
    if isinstance(target, bool) or not isinstance(target, (int, float)) or not 0.05 <= target <= 0.98:
        print(json.dumps({'errors': {'targetProbability': 'Enter a probability from 0.05 to 0.98.'}}))
        sys.exit(0)
    print(json.dumps(solve_counterfactual(values, target)))
    sys.exit(0)

p = float(predict_probabilities([values])[0])
pred = 1 if p >= 0.5 else 0
result = {'probability': p, 'score': p * 100, 'predictedClass': 'Placed' if pred == 1 else 'Not Placed', 'modelVersion': version, 'modelName': type(model).__name__, 'featureOrder': feature_names, 'inputs': {name: values[name] for name in raw_names}}
if op == 'assessment':
    result['explanation'] = explain_profile(values)
print(json.dumps(result))
