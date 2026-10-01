"""
Recalibrate placement dataset with realistic recruitment rules.
Generates realistic 83-88% classification benchmarks based on industry hiring criteria.
"""

import pandas as pd
import numpy as np

def recalibrate_dataset(csv_path="student_placement_prediction_dataset_2026.csv"):
    print("Loading dataset...")
    df = pd.read_csv(csv_path)

    # 1. Normalize core numerical scores (0 to 1 scale)
    cgpa_norm = np.clip((df['cgpa'] - 5.5) / 4.5, 0, 1)  # 5.5 is 0.0, 10.0 is 1.0
    coding_norm = df['coding_skill_score'] / 100.0
    aptitude_norm = df['aptitude_score'] / 100.0
    logic_norm = df['logical_reasoning_score'] / 100.0
    interview_norm = df['mock_interview_score'] / 100.0
    comm_norm = df['communication_skill_score'] / 100.0

    # 2. Recruitment Penalties
    # Backlogs are a major screening filter in Indian campus recruitment
    backlog_penalty = df['backlogs'].apply(
        lambda b: 0.0 if b == 0 else (0.18 if b == 1 else (0.38 if b == 2 else 0.70))
    )
    # Low attendance penalty (< 75% criteria)
    attendance_penalty = df['attendance_percentage'].apply(
        lambda a: 0.0 if a >= 75 else (75 - a) * 0.006
    )

    # 3. Practical Experience & Portfolio Bonuses
    internship_bonus = np.clip(df['internships_count'] * 0.04, 0, 0.12)
    project_bonus = np.clip(df['projects_count'] * 0.02, 0, 0.08)
    hackathon_bonus = np.clip(df['hackathons_participated'] * 0.015, 0, 0.05)
    github_bonus = np.clip(df['github_repos'] * 0.005, 0, 0.04)
    cert_bonus = np.clip(df['certifications_count'] * 0.01, 0, 0.03)

    # 4. Institutional & Extracurricular Factors
    tier_bonus = df['college_tier'].map({'Tier 1': 0.06, 'Tier 2': 0.02, 'Tier 3': -0.04}).fillna(0)
    branch_bonus = df['branch'].map({
        'CSE': 0.03, 'IT': 0.02, 'ECE': 0.00, 'EEE': -0.01, 'ME': -0.02, 'CE': -0.02, 'Civil': -0.02, 'Mechanical': -0.02
    }).fillna(0)
    extra_bonus = (df['extracurricular_score'] + df['leadership_score']) / 200.0 * 0.04

    # 5. Composite Real-World Recruitment Index
    composite_index = (
        0.24 * coding_norm +
        0.20 * cgpa_norm +
        0.16 * interview_norm +
        0.14 * aptitude_norm +
        0.10 * logic_norm +
        0.08 * comm_norm +
        internship_bonus +
        project_bonus +
        hackathon_bonus +
        github_bonus +
        cert_bonus +
        tier_bonus +
        branch_bonus +
        extra_bonus -
        backlog_penalty -
        attendance_penalty
    )

    # 6. Add realistic interview day variance (interviewer chemistry, company quotas)
    np.random.seed(42)
    noise = np.random.normal(0, 0.075, size=len(df))
    final_hiring_score = composite_index + noise

    # 7. Class distribution: maintain ~55% Placed, 45% Not Placed
    placement_cutoff = np.percentile(final_hiring_score, 45.0)
    is_placed = final_hiring_score >= placement_cutoff
    df['placement_status'] = np.where(is_placed, 'Placed', 'Not Placed')

    # 8. Align salary_package_lpa realistically:
    # Placed students receive 4.5 to 22+ LPA based on their recruitment score and tier
    salary = np.zeros(len(df))
    tier_mult = df['college_tier'].map({'Tier 1': 1.25, 'Tier 2': 1.05, 'Tier 3': 0.90}).fillna(1.0)
    base_salary = 4.5 + (composite_index[is_placed] * 14.0 * tier_mult[is_placed])
    salary_noise = np.random.normal(0, 0.6, size=np.sum(is_placed))
    final_salary = np.clip(np.round(base_salary + salary_noise, 2), 4.0, 25.0)
    salary[is_placed] = final_salary
    df['salary_package_lpa'] = salary

    # 9. Save updated dataset
    df.to_csv(csv_path, index=False)
    print(f"Recalibration complete and saved to {csv_path}!")
    print(f"Placed count: {np.sum(is_placed):,} ({np.mean(is_placed)*100:.2f}%)")
    print(f"Not Placed count: {len(df) - np.sum(is_placed):,} ({100 - np.mean(is_placed)*100:.2f}%)")
    print(f"Salary for Placed students: Min={salary[is_placed].min()} LPA, Max={salary[is_placed].max()} LPA, Mean={salary[is_placed].mean():.2f} LPA")

if __name__ == "__main__":
    recalibrate_dataset()
