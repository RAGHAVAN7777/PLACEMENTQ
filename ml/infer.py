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
payload = json.load(sys.stdin)
if payload.get('operation') == 'schema':
    print(json.dumps({'fields': schema, 'featureOrder': feature_names, 'modelVersion': version, 'modelName': type(model).__name__}))
    sys.exit(0)

values = payload.get('inputs', {})
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

X = pd.DataFrame([{name: values[name] for name in raw_names}], columns=raw_names)
for name, encoder in encoders.items():
    X[name] = encoder.transform(X[name].astype(str))
# Exactly the existing train.py preprocessing, using original fitted encoders/scaler.
X['tech_core_score'] = X.coding_skill_score * .40 + X.aptitude_score * .25 + X.logical_reasoning_score * .20 + X.mock_interview_score * .15
X['academic_consistency'] = (X.cgpa / 10) * (X.attendance_percentage / 100)
X['backlog_risk_ratio'] = X.backlogs / (X.attendance_percentage + 1)
X['coding_cgpa_interaction'] = X.coding_skill_score * X.cgpa
X['portfolio_strength'] = X.internships_count * 2.5 + X.projects_count * 1.5 + X.hackathons_participated * 1.2 + X.certifications_count * .8 + X.github_repos * .3
X['interview_readiness'] = X.mock_interview_score * .6 + X.communication_skill_score * .4
X['high_performer_flag'] = ((X.cgpa >= 8) & (X.coding_skill_score >= 75)).astype(int)
X['zero_backlog_flag'] = (X.backlogs == 0).astype(int)
transformed = scaler.transform(X.loc[:, feature_names])
placed_index = list(model.classes_).index(1)
probability = float(model.predict_proba(transformed)[0, placed_index])
predicted = int(model.predict(transformed)[0])
print(json.dumps({'probability': probability, 'score': probability * 100, 'predictedClass': 'Placed' if predicted == 1 else 'Not Placed', 'modelVersion': version, 'modelName': type(model).__name__, 'featureOrder': feature_names, 'inputs': {name: values[name] for name in raw_names}}))
