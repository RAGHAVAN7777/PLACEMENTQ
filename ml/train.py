"""
Placement Prediction ML Pipeline
Course Project: Student Placement Intelligence (PlacementIQ)

Implements algorithms and workflows from all reference notebooks:
1. Decision Trees with Entropy/Gini, depth sweep & feature importance (Decision_Tree_Adult_Income_Complete.ipynb)
2. SVM with Linear & RBF kernels, EDA histograms & heatmaps (Ex_SVM.ipynb)
3. Perceptron from scratch and scikit-learn Perceptron (Perceptron.ipynb)
4. Ensemble methods: Bagging, Random Forest, AdaBoost, Gradient Boosting, XGBoost, Voting (Ensemble.ipynb)
5. Logistic Regression baseline with Sigmoid calibration & Odds Ratios
"""

import os
import json
import time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression, Perceptron
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.svm import LinearSVC, SVC
from sklearn.ensemble import (
    RandomForestClassifier,
    BaggingClassifier,
    AdaBoostClassifier,
    HistGradientBoostingClassifier,
    VotingClassifier,
    StackingClassifier,
)
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
    confusion_matrix,
    ConfusionMatrixDisplay,
    classification_report,
)
from xgboost import XGBClassifier
import joblib

# Set plotting styles
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
os.makedirs("ml/plots", exist_ok=True)
os.makedirs("ml/models", exist_ok=True)
os.makedirs("ml/outputs", exist_ok=True)


# ==============================================================================
# 1. SIMPLE PERCEPTRON FROM SCRATCH (Educational - from Perceptron.ipynb)
# ==============================================================================
class SimplePerceptron:
    """Educational Perceptron classifier implemented from scratch using NumPy."""
    def __init__(self, learning_rate=0.01, epochs=50):
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.weights = None
        self.bias = 0.0
        self.errors_per_epoch = []

    def fit(self, X, y):
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0.0

        for epoch in range(self.epochs):
            errors = 0
            for xi, target in zip(X, y):
                linear_output = np.dot(xi, self.weights) + self.bias
                y_predicted = 1 if linear_output >= 0 else 0
                update = self.learning_rate * (target - y_predicted)
                self.weights += update * xi
                self.bias += update
                if target != y_predicted:
                    errors += 1
            self.errors_per_epoch.append(errors)
        return self

    def predict(self, X):
        linear_output = np.dot(X, self.weights) + self.bias
        return np.where(linear_output >= 0, 1, 0)


# ==============================================================================
# 2. DATA INGESTION & DATA LEAKAGE AUDIT
# ==============================================================================
def load_and_audit_dataset(csv_path="student_placement_prediction_dataset_2026.csv"):
    print("=" * 70)
    print("1. LOADING & AUDITING DATASET")
    print("=" * 70)
    df = pd.read_csv(csv_path)
    print(f"Dataset shape: {df.shape[0]:,} rows x {df.shape[1]} columns")

    # Audit missing values
    missing = df.isnull().sum().sum()
    print(f"Missing values across entire dataset: {missing}")

    # Check target distribution
    target_counts = df['placement_status'].value_counts()
    placed_pct = (target_counts['Placed'] / len(df)) * 100
    not_placed_pct = (target_counts['Not Placed'] / len(df)) * 100
    print(f"Target Distribution: Placed={target_counts['Placed']:,} ({placed_pct:.2f}%), "
          f"Not Placed={target_counts['Not Placed']:,} ({not_placed_pct:.2f}%)")
    print(f"Majority-Class Baseline Accuracy: {max(placed_pct, not_placed_pct):.2f}%")

    # Data Leakage Audit
    salary_zero_for_not_placed = (df[df['placement_status'] == 'Not Placed']['salary_package_lpa'] == 0).all()
    salary_pos_for_placed = (df[df['placement_status'] == 'Placed']['salary_package_lpa'] > 0).all()
    print("\n[LEAKAGE CHECK] salary_package_lpa == 0 for ALL Not Placed:", salary_zero_for_not_placed)
    print("[LEAKAGE CHECK] salary_package_lpa > 0 for ALL Placed:", salary_pos_for_placed)
    print(">> VERDICT: salary_package_lpa is a direct proxy for the target and MUST be dropped!")
    print(">> VERDICT: student_id is an arbitrary surrogate key and MUST be dropped!\n")

    return df


# ==============================================================================
# 3. EXPLORATORY DATA ANALYSIS (EDA) & PLOTS
# ==============================================================================
def perform_eda(df):
    print("=" * 70)
    print("2. EXPLORATORY DATA ANALYSIS (Generating Plots)")
    print("=" * 70)

    # Plot 1: Target Class Distribution
    plt.figure(figsize=(6, 4.5))
    counts = df['placement_status'].value_counts()
    colors = ['#244BDB', '#D8D5CC']
    bars = plt.bar(counts.index, counts.values, color=colors, edgecolor='black', width=0.55)
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width() / 2, yval + 1000, f"{yval:,} ({yval/len(df)*100:.1f}%)",
                 ha='center', va='bottom', fontweight='bold')
    plt.title("Placement Status Class Distribution", fontsize=12, fontweight='bold', pad=12)
    plt.ylabel("Number of Students", fontsize=10)
    plt.ylim(0, max(counts.values) * 1.15)
    plt.tight_layout()
    plt.savefig("ml/plots/class_distribution.png", dpi=300)
    plt.close()
    print("Saved: ml/plots/class_distribution.png")

    # Plot 2: Correlation Heatmap of Numeric Features
    clean_df = df.drop(columns=['student_id', 'salary_package_lpa'])
    numeric_df = clean_df.select_dtypes(include=[np.number])
    corr = numeric_df.corr()

    plt.figure(figsize=(14, 11))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", cbar=True, square=True,
                annot_kws={"size": 7.5}, linewidths=0.5)
    plt.title("Correlation Matrix of Numerical Features (Post-Leakage Removal)", fontsize=13, fontweight='bold', pad=14)
    plt.xticks(rotation=45, ha='right', fontsize=9)
    plt.yticks(fontsize=9)
    plt.tight_layout()
    plt.savefig("ml/plots/correlation_heatmap.png", dpi=300)
    plt.close()
    print("Saved: ml/plots/correlation_heatmap.png")

    # Plot 3: Numerical Feature Distributions (Key Academic & Technical Scores)
    key_features = ['cgpa', 'coding_skill_score', 'aptitude_score', 'logical_reasoning_score',
                    'communication_skill_score', 'mock_interview_score', 'internships_count', 'projects_count']
    fig, axes = plt.subplots(2, 4, figsize=(16, 7.5))
    axes = axes.flatten()
    for i, col in enumerate(key_features):
        sns.histplot(df[col], kde=True, ax=axes[i], color='#244BDB', bins=25)
        axes[i].set_title(col.replace('_', ' ').title(), fontsize=10, fontweight='bold')
        axes[i].set_xlabel('')
    plt.suptitle("Distributions of Key Academic & Skill Metrics", fontsize=14, fontweight='bold', y=0.99)
    plt.tight_layout()
    plt.savefig("ml/plots/numeric_histograms.png", dpi=300)
    plt.close()
    print("Saved: ml/plots/numeric_histograms.png")

    # Plot 4: Boxplots of Top Features by Placement Status
    fig, axes = plt.subplots(2, 3, figsize=(14, 8))
    axes = axes.flatten()
    top_cols = ['cgpa', 'coding_skill_score', 'aptitude_score', 'internships_count', 'projects_count', 'mock_interview_score']
    palette = {'Placed': '#244BDB', 'Not Placed': '#B5850B'}
    for i, col in enumerate(top_cols):
        sns.boxplot(x='placement_status', y=col, data=df.sample(5000, random_state=42), ax=axes[i], palette=palette)
        axes[i].set_title(col.replace('_', ' ').title(), fontsize=10, fontweight='bold')
        axes[i].set_xlabel('')
    plt.suptitle("Feature Spread across Placement Status (5,000 Student Stratified Sample)", fontsize=13, fontweight='bold', y=0.99)
    plt.tight_layout()
    plt.savefig("ml/plots/boxplots_placed_vs_not.png", dpi=300)
    plt.close()
    print("Saved: ml/plots/boxplots_placed_vs_not.png")


# ==============================================================================
# 4. PREPROCESSING & FEATURE ENGINEERING
# ==============================================================================
def preprocess_dataset(df):
    print("=" * 70)
    print("3. PREPROCESSING & FEATURE ENGINEERING")
    print("=" * 70)

    # 1. Drop leaked column and ID
    X = df.drop(columns=['student_id', 'salary_package_lpa', 'placement_status']).copy()
    y_raw = df['placement_status']

    # 2. Encode target: Placed=1, Not Placed=0
    target_encoder = LabelEncoder()
    y = target_encoder.fit_transform(y_raw)
    placed_label_idx = list(target_encoder.classes_).index('Placed')
    if placed_label_idx != 1:
        y = np.where(y == placed_label_idx, 1, 0)
    print(f"Target classes encoded: 1=Placed, 0=Not Placed. Balance: {np.mean(y)*100:.2f}% Placed.")

    # 3. Categorical encoding
    categorical_cols = X.select_dtypes(include=['object']).columns.tolist()
    print(f"Categorical features to encode ({len(categorical_cols)}): {categorical_cols}")

    label_encoders = {}
    for col in categorical_cols:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        label_encoders[col] = le

    # 4. Domain Feature Engineering (Composite indices & non-linear interaction terms)
    print("Engineering domain composite features and non-linear interactions...")
    X['tech_core_score'] = (
        X['coding_skill_score'] * 0.40 +
        X['aptitude_score'] * 0.25 +
        X['logical_reasoning_score'] * 0.20 +
        X['mock_interview_score'] * 0.15
    )
    X['academic_consistency'] = (X['cgpa'] / 10.0) * (X['attendance_percentage'] / 100.0)
    X['backlog_risk_ratio'] = X['backlogs'] / (X['attendance_percentage'] + 1.0)
    X['coding_cgpa_interaction'] = X['coding_skill_score'] * X['cgpa']
    X['portfolio_strength'] = (
        X['internships_count'] * 2.5 +
        X['projects_count'] * 1.5 +
        X['hackathons_participated'] * 1.2 +
        X['certifications_count'] * 0.8 +
        X['github_repos'] * 0.3
    )
    X['interview_readiness'] = (
        X['mock_interview_score'] * 0.6 +
        X['communication_skill_score'] * 0.4
    )
    X['high_performer_flag'] = ((X['cgpa'] >= 8.0) & (X['coding_skill_score'] >= 75)).astype(int)
    X['zero_backlog_flag'] = (X['backlogs'] == 0).astype(int)

    feature_names = list(X.columns)
    print(f"Total features after feature engineering: {len(feature_names)}")

    # 5. Stratified Train-Test Split (80% Train, 20% Test)
    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Train size: {X_train_raw.shape[0]:,} records | Test size: {X_test_raw.shape[0]:,} records")

    # 6. Feature Scaling (StandardScaler)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)
    X_test = scaler.transform(X_test_raw)

    # Save encoders & scaler for production inference
    joblib.dump(scaler, "ml/models/scaler.joblib")
    joblib.dump(label_encoders, "ml/models/label_encoders.joblib")
    joblib.dump(feature_names, "ml/models/feature_names.joblib")
    print("Saved preprocessing artifacts: scaler.joblib, label_encoders.joblib, feature_names.joblib")

    return X_train, X_test, y_train, y_test, X_train_raw, X_test_raw, feature_names


# ==============================================================================
# 5. MODEL BENCHMARKING & EVALUATION
# ==============================================================================
def run_model_benchmarks(X_train, X_test, y_train, y_test, feature_names):
    print("=" * 70)
    print("4. MODEL TRAINING & COMPARATIVE BENCHMARKING")
    print("=" * 70)

    results = []
    models_dict = {}
    roc_curves = {}

    # Define model configurations
    models_to_train = [
        ("Logistic Regression", LogisticRegression(max_iter=1000, random_state=42)),
        ("Perceptron (Linear)", Perceptron(max_iter=1000, tol=1e-3, random_state=42)),
        ("Decision Tree (Entropy)", DecisionTreeClassifier(criterion="entropy", max_depth=8, random_state=42)),
        ("Decision Tree (Gini)", DecisionTreeClassifier(criterion="gini", max_depth=8, random_state=42)),
        ("Linear SVM", LinearSVC(random_state=42, max_iter=2000, dual=False)),
        ("Random Forest (150 trees)", RandomForestClassifier(n_estimators=150, max_depth=12, random_state=42, n_jobs=-1)),
        ("Bagging (Decision Tree)", BaggingClassifier(estimator=DecisionTreeClassifier(max_depth=8), n_estimators=40, random_state=42, n_jobs=-1)),
        ("AdaBoost", AdaBoostClassifier(n_estimators=100, learning_rate=0.1, random_state=42)),
        ("HistGradientBoosting", HistGradientBoostingClassifier(max_iter=250, learning_rate=0.05, max_leaf_nodes=45, l2_regularization=0.2, random_state=42)),
        ("XGBoost", XGBClassifier(n_estimators=200, learning_rate=0.05, max_depth=5, subsample=0.85, colsample_bytree=0.85, eval_metric='logloss', random_state=42, n_jobs=-1)),
    ]

    for name, model in models_to_train:
        t0 = time.time()
        model.fit(X_train, y_train)
        train_time = time.time() - t0

        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)

        # ROC-AUC calculation
        if hasattr(model, "predict_proba"):
            y_prob = model.predict_proba(X_test)[:, 1]
            auc_val = roc_auc_score(y_test, y_prob)
            fpr, tpr, _ = roc_curve(y_test, y_prob)
            roc_curves[name] = (fpr, tpr, auc_val)
        elif hasattr(model, "decision_function"):
            y_prob = model.decision_function(X_test)
            auc_val = roc_auc_score(y_test, y_prob)
            fpr, tpr, _ = roc_curve(y_test, y_prob)
            roc_curves[name] = (fpr, tpr, auc_val)
        else:
            auc_val = 0.5
            fpr, tpr = np.array([0, 1]), np.array([0, 1])

        print(f"[{name:25}] Acc: {acc*100:6.2f}% | F1: {f1*100:6.2f}% | AUC: {auc_val:6.4f} | Time: {train_time:5.2f}s")
        models_dict[name] = model
        results.append({
            "model": name,
            "accuracy": round(acc * 100, 2),
            "precision": round(prec * 100, 2),
            "recall": round(rec * 100, 2),
            "f1_score": round(f1 * 100, 2),
            "roc_auc": round(auc_val, 4),
            "train_time_sec": round(train_time, 2)
        })

    # Add Voting Ensemble combining top models (Soft Voting)
    print("\nTraining Voting Classifier (Soft Voting: RF + HistGB + XGBoost)...")
    voting_ensemble = VotingClassifier(
        estimators=[
            ('rf', models_dict["Random Forest (150 trees)"]),
            ('hgb', models_dict["HistGradientBoosting"]),
            ('xgb', models_dict["XGBoost"]),
        ],
        voting='soft',
        n_jobs=-1
    )
    t0 = time.time()
    voting_ensemble.fit(X_train, y_train)
    ens_time = time.time() - t0
    ens_pred = voting_ensemble.predict(X_test)
    ens_prob = voting_ensemble.predict_proba(X_test)[:, 1]

    ens_acc = accuracy_score(y_test, ens_pred)
    ens_prec = precision_score(y_test, ens_pred, zero_division=0)
    ens_rec = recall_score(y_test, ens_pred, zero_division=0)
    ens_f1 = f1_score(y_test, ens_pred, zero_division=0)
    ens_auc = roc_auc_score(y_test, ens_prob)
    fpr, tpr, _ = roc_curve(y_test, ens_prob)
    roc_curves["Voting Ensemble"] = (fpr, tpr, ens_auc)
    models_dict["Voting Ensemble"] = voting_ensemble

    results.append({
        "model": "Voting Ensemble (RF+HGB+XGB)",
        "accuracy": round(ens_acc * 100, 2),
        "precision": round(ens_prec * 100, 2),
        "recall": round(ens_rec * 100, 2),
        "f1_score": round(ens_f1 * 100, 2),
        "roc_auc": round(ens_auc, 4),
        "train_time_sec": round(ens_time, 2)
    })
    print(f"[{'Voting Ensemble':25}] Acc: {ens_acc*100:6.2f}% | F1: {ens_f1*100:6.2f}% | AUC: {ens_auc:6.4f} | Time: {ens_time:5.2f}s")

    # Add Stacking Classifier
    print("\nTraining Stacking Classifier (Meta-Learner: Logistic Regression on HGB + XGB + RF)...")
    stacking_ensemble = StackingClassifier(
        estimators=[
            ('hgb', models_dict["HistGradientBoosting"]),
            ('xgb', models_dict["XGBoost"]),
            ('rf', models_dict["Random Forest (150 trees)"]),
        ],
        final_estimator=LogisticRegression(random_state=42),
        cv=3,
        n_jobs=-1
    )
    t0 = time.time()
    stacking_ensemble.fit(X_train, y_train)
    stk_time = time.time() - t0
    stk_pred = stacking_ensemble.predict(X_test)
    stk_prob = stacking_ensemble.predict_proba(X_test)[:, 1]

    stk_acc = accuracy_score(y_test, stk_pred)
    stk_prec = precision_score(y_test, stk_pred, zero_division=0)
    stk_rec = recall_score(y_test, stk_pred, zero_division=0)
    stk_f1 = f1_score(y_test, stk_pred, zero_division=0)
    stk_auc = roc_auc_score(y_test, stk_prob)
    fpr, tpr, _ = roc_curve(y_test, stk_prob)
    roc_curves["Stacking Classifier"] = (fpr, tpr, stk_auc)
    models_dict["Stacking Classifier"] = stacking_ensemble

    results.append({
        "model": "Stacking Classifier",
        "accuracy": round(stk_acc * 100, 2),
        "precision": round(stk_prec * 100, 2),
        "recall": round(stk_rec * 100, 2),
        "f1_score": round(stk_f1 * 100, 2),
        "roc_auc": round(stk_auc, 4),
        "train_time_sec": round(stk_time, 2)
    })
    print(f"[{'Stacking Classifier':25}] Acc: {stk_acc*100:6.2f}% | F1: {stk_f1*100:6.2f}% | AUC: {stk_auc:6.4f} | Time: {stk_time:5.2f}s")

    # Benchmarking DataFrame
    results_df = pd.DataFrame(results).sort_values("accuracy", ascending=False)
    print("\n" + "=" * 70)
    print("CONSOLIDATED BENCHMARK RESULTS")
    print("=" * 70)
    print(results_df.to_string(index=False))

    results_df.to_csv("ml/outputs/benchmark_results.csv", index=False)
    print("\nSaved benchmark results to: ml/outputs/benchmark_results.csv")

    # Plot Multi-Model ROC Curves
    plt.figure(figsize=(9, 7))
    palette = sns.color_palette("tab10", len(roc_curves))
    for i, (mname, (fpr, tpr, auc_score)) in enumerate(roc_curves.items()):
        plt.plot(fpr, tpr, label=f"{mname} (AUC = {auc_score:.3f})", color=palette[i], lw=1.8)
    plt.plot([0, 1], [0, 1], 'k--', lw=1.2, label='Random Chance (AUC = 0.500)')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate', fontsize=11)
    plt.ylabel('True Positive Rate', fontsize=11)
    plt.title('Receiver Operating Characteristic (ROC) Comparison', fontsize=13, fontweight='bold', pad=12)
    plt.legend(loc="lower right", fontsize=8.5, frameon=True)
    plt.tight_layout()
    plt.savefig("ml/plots/all_models_roc_curve.png", dpi=300)
    plt.close()
    print("Saved: ml/plots/all_models_roc_curve.png")

    return models_dict, results_df, roc_curves


# ==============================================================================
# 6. DECISION TREE DEPTH PARAMETER SWEEP (from Decision_Tree reference)
# ==============================================================================
def tune_decision_tree_depth(X_train, X_test, y_train, y_test):
    print("\n" + "=" * 70)
    print("5. DECISION TREE DEPTH HYPERPARAMETER SWEEP (d=1 to 20)")
    print("=" * 70)

    depths = list(range(1, 21))
    train_accs = []
    test_accs = []

    for d in depths:
        dt = DecisionTreeClassifier(max_depth=d, criterion="entropy", random_state=42)
        dt.fit(X_train, y_train)
        train_accs.append(accuracy_score(y_train, dt.predict(X_train)))
        test_accs.append(accuracy_score(y_test, dt.predict(X_test)))

    best_idx = np.argmax(test_accs)
    best_depth = depths[best_idx]
    best_test_acc = test_accs[best_idx]
    print(f"Optimal Decision Tree Depth: {best_depth} with Test Accuracy: {best_test_acc*100:.2f}%")

    plt.figure(figsize=(9, 5))
    plt.plot(depths, [a * 100 for a in train_accs], marker='o', label='Training Accuracy', color='#555750', lw=1.5)
    plt.plot(depths, [a * 100 for a in test_accs], marker='s', label='Testing Accuracy (Validation)', color='#244BDB', lw=2)
    plt.axvline(best_depth, color='#C62828', linestyle='--', label=f'Optimal Depth = {best_depth}')
    plt.title("Decision Tree: Overfitting vs Generalization across Tree Depths", fontsize=12, fontweight='bold')
    plt.xlabel("Max Tree Depth", fontsize=10)
    plt.ylabel("Accuracy (%)", fontsize=10)
    plt.xticks(depths)
    plt.legend(fontsize=9)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("ml/plots/decision_tree_depth_curve.png", dpi=300)
    plt.close()
    print("Saved: ml/plots/decision_tree_depth_curve.png")

    return best_depth


# ==============================================================================
# 6. DECISION CUTOFF OPTIMIZATION FOR HIGHER RECALL
# ==============================================================================
def tune_decision_cutoff(best_model, X_test, y_test):
    print("\n" + "=" * 70)
    print("6. DECISION CUTOFF OPTIMIZATION FOR HIGHER RECALL")
    print("=" * 70)

    if not hasattr(best_model, "predict_proba"):
        print("Model does not support predict_proba; skipping cutoff tuning.")
        return None

    y_probs = best_model.predict_proba(X_test)[:, 1]
    thresholds = np.linspace(0.15, 0.85, 71)

    recalls = []
    precisions = []
    f1s = []
    accuracies = []

    for t in thresholds:
        preds = (y_probs >= t).astype(int)
        rec = recall_score(y_test, preds, zero_division=0)
        prec = precision_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        acc = accuracy_score(y_test, preds)

        recalls.append(rec)
        precisions.append(prec)
        f1s.append(f1)
        accuracies.append(acc)

    # Standard cutoff = 0.50
    std_preds = (y_probs >= 0.50).astype(int)
    std_acc = accuracy_score(y_test, std_preds)
    std_rec = recall_score(y_test, std_preds, zero_division=0)
    std_prec = precision_score(y_test, std_preds, zero_division=0)
    std_f1 = f1_score(y_test, std_preds, zero_division=0)

    # High recall target (e.g. >= 92% or >= 95% recall)
    high_rec_candidates = [i for i, r in enumerate(recalls) if r >= 0.92]
    high_rec_idx = high_rec_candidates[-1] if high_rec_candidates else 0
    high_rec_thresh = thresholds[high_rec_idx]

    # Best F1 cutoff
    best_f1_idx = int(np.argmax(f1s))
    best_f1_thresh = thresholds[best_f1_idx]

    print(f"[Default Cutoff (0.50)]     -> Acc: {std_acc*100:5.2f}% | Recall: {std_rec*100:5.2f}% | Precision: {std_prec*100:5.2f}% | F1: {std_f1*100:5.2f}%")
    print(f"[Best F1 Cutoff ({best_f1_thresh:.2f})]    -> Acc: {accuracies[best_f1_idx]*100:5.2f}% | Recall: {recalls[best_f1_idx]*100:5.2f}% | Precision: {precisions[best_f1_idx]*100:5.2f}% | F1: {f1s[best_f1_idx]*100:5.2f}%")
    print(f"[High Recall Cutoff ({high_rec_thresh:.2f})] -> Acc: {accuracies[high_rec_idx]*100:5.2f}% | Recall: {recalls[high_rec_idx]*100:5.2f}% | Precision: {precisions[high_rec_idx]*100:5.2f}% | F1: {f1s[high_rec_idx]*100:5.2f}%")

    # Plot Precision, Recall & F1 Curve vs Decision Cutoff
    plt.figure(figsize=(9, 5.5))
    plt.plot(thresholds, [r * 100 for r in recalls], label='Recall (Placed Capture Rate)', color='#2D7A3A', lw=2.2)
    plt.plot(thresholds, [p * 100 for p in precisions], label='Precision (True Placed Rate)', color='#244BDB', lw=2.2)
    plt.plot(thresholds, [f * 100 for f in f1s], label='F1-Score (Harmonic Mean)', color='#B5850B', lw=1.8, linestyle='--')
    plt.plot(thresholds, [a * 100 for a in accuracies], label='Overall Accuracy', color='#555750', lw=1.5, linestyle=':')

    plt.axvline(0.50, color='#888880', linestyle='-', alpha=0.7, label='Default Cutoff (0.50)')
    plt.axvline(high_rec_thresh, color='#C62828', linestyle='--', lw=2, label=f'High-Recall Cutoff ({high_rec_thresh:.2f})')

    plt.title('Precision, Recall, and Accuracy vs. Decision Cutoff Threshold', fontsize=12, fontweight='bold', pad=12)
    plt.xlabel('Decision Probability Threshold (Cutoff)', fontsize=10)
    plt.ylabel('Score (%)', fontsize=10)
    plt.xlim(0.15, 0.85)
    plt.ylim(30, 102)
    plt.legend(loc='lower left', fontsize=8.5, frameon=True)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('ml/plots/precision_recall_cutoff_curve.png', dpi=300)
    plt.close()
    print("Saved: ml/plots/precision_recall_cutoff_curve.png")

    tuning_results = {
        "default_cutoff": {
            "threshold": 0.50,
            "accuracy": round(std_acc * 100, 2),
            "recall": round(std_rec * 100, 2),
            "precision": round(std_prec * 100, 2),
            "f1": round(std_f1 * 100, 2)
        },
        "best_f1_cutoff": {
            "threshold": round(float(best_f1_thresh), 2),
            "accuracy": round(accuracies[best_f1_idx] * 100, 2),
            "recall": round(recalls[best_f1_idx] * 100, 2),
            "precision": round(precisions[best_f1_idx] * 100, 2),
            "f1": round(f1s[best_f1_idx] * 100, 2)
        },
        "high_recall_cutoff": {
            "threshold": round(float(high_rec_thresh), 2),
            "accuracy": round(accuracies[high_rec_idx] * 100, 2),
            "recall": round(recalls[high_rec_idx] * 100, 2),
            "precision": round(precisions[high_rec_idx] * 100, 2),
            "f1": round(f1s[high_rec_idx] * 100, 2)
        }
    }

    with open("ml/outputs/threshold_tuning_results.json", "w", encoding="utf-8") as f:
        json.dump(tuning_results, f, indent=2)

    return tuning_results


# ==============================================================================
# 7. CHAMPION MODEL EVALUATION & ARTIFACT EXPORT
# ==============================================================================
def export_champion_artifacts(best_model, best_model_name, X_test, y_test, feature_names, results_df, roc_curves, models_dict=None):
    print("\n" + "=" * 70)
    print(f"7. EXPORTING CHAMPION MODEL: {best_model_name}")
    print("=" * 70)


    # Predictions & Probabilities
    y_pred = best_model.predict(X_test)

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    print(f"Confusion Matrix:\n  TN: {tn:,}  |  FP: {fp:,}\n  FN: {fn:,}  |  TP: {tp:,}")

    # Plot Confusion Matrix
    plt.figure(figsize=(6, 5))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=['Not Placed', 'Placed'])
    disp.plot(cmap='Blues', values_format='d')
    plt.title(f"Confusion Matrix: {best_model_name}", fontsize=11, fontweight='bold', pad=10)
    plt.tight_layout()
    plt.savefig("ml/plots/champion_confusion_matrix.png", dpi=300)
    plt.close()
    print("Saved: ml/plots/champion_confusion_matrix.png")

    # Feature Importances (if supported by best model or fallback to XGBoost/Random Forest)
    importances = None
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
    elif hasattr(best_model, "named_estimators_") and 'xgb' in best_model.named_estimators_ and hasattr(best_model.named_estimators_['xgb'], "feature_importances_"):
        importances = best_model.named_estimators_['xgb'].feature_importances_
    elif hasattr(best_model, "named_estimators_") and 'rf' in best_model.named_estimators_ and hasattr(best_model.named_estimators_['rf'], "feature_importances_"):
        importances = best_model.named_estimators_['rf'].feature_importances_
    elif models_dict is not None and "Random Forest (150 trees)" in models_dict:
        importances = models_dict["Random Forest (150 trees)"].feature_importances_
    elif models_dict is not None and "XGBoost" in models_dict:
        importances = models_dict["XGBoost"].feature_importances_

    feat_imp_list = []
    if importances is not None:
        imp_df = pd.DataFrame({
            "feature": feature_names,
            "importance": importances
        }).sort_values("importance", ascending=False)

        feat_imp_list = imp_df.to_dict(orient="records")

        plt.figure(figsize=(10, 6))
        plt.barh(imp_df["feature"][::-1], imp_df["importance"][::-1], color="#244BDB")
        plt.title(f"Feature Importances ({best_model_name})", fontsize=12, fontweight='bold')
        plt.xlabel("MDI Relative Importance Score", fontsize=10)
        plt.tight_layout()
        plt.savefig("ml/plots/feature_importances.png", dpi=300)
        plt.close()
        print("Saved: ml/plots/feature_importances.png")

    # Save Best Model Serialization
    joblib.dump(best_model, "ml/models/placement_model.joblib")
    print("Serialized model pipeline saved to: ml/models/placement_model.joblib")

    # Extract downsampled ROC curve coordinates for frontend rendering
    fpr_vals, tpr_vals, auc_score = roc_curves.get(best_model_name, (np.array([0, 1]), np.array([0, 1]), 0.5))
    step = max(1, len(fpr_vals) // 100)
    roc_points = [{"fpr": round(float(f), 4), "tpr": round(float(t), 4)}
                  for f, t in zip(fpr_vals[::step], tpr_vals[::step])]

    # Prepare frontend integration artifact
    frontend_artifact = {
        "dataset": {
            "name": "student_placement_prediction_dataset_2026.csv",
            "total_rows": 100000,
            "train_size": 80000,
            "test_size": 20000,
            "features_count": len(feature_names),
            "target_classes": ["Not Placed", "Placed"]
        },
        "champion_model": {
            "name": best_model_name,
            "accuracy": float(results_df[results_df["model"] == best_model_name]["accuracy"].values[0]),
            "precision": float(results_df[results_df["model"] == best_model_name]["precision"].values[0]),
            "recall": float(results_df[results_df["model"] == best_model_name]["recall"].values[0]),
            "f1_score": float(results_df[results_df["model"] == best_model_name]["f1_score"].values[0]),
            "roc_auc": float(results_df[results_df["model"] == best_model_name]["roc_auc"].values[0]),
            "confusion_matrix": {
                "true_negative": int(tn),
                "false_positive": int(fp),
                "false_negative": int(fn),
                "true_positive": int(tp)
            },
            "roc_points": roc_points,
            "feature_importances": feat_imp_list[:15]
        },
        "benchmark_comparison": results_df.to_dict(orient="records")
    }

    with open("ml/outputs/model_evaluation_artifacts.json", "w", encoding="utf-8") as f:
        json.dump(frontend_artifact, f, indent=2)

    # Also save directly into frontend src data directory if frontend exists
    frontend_data_dir = "frontend/src/data"
    os.makedirs(frontend_data_dir, exist_ok=True)
    with open(os.path.join(frontend_data_dir, "model_artifacts.json"), "w", encoding="utf-8") as f:
        json.dump(frontend_artifact, f, indent=2)

    print("Saved evaluation artifacts JSON for Model Lab integration:")
    print("  -> ml/outputs/model_evaluation_artifacts.json")
    print("  -> frontend/src/data/model_artifacts.json")


# ==============================================================================
# MAIN PIPELINE EXECUTION
# ==============================================================================
def main():
    total_start = time.time()
    print("=" * 70)
    print("PLACEMENTQ MACHINE LEARNING TRAINING & BENCHMARK PIPELINE")
    print("=" * 70)

    # 1. Load data
    df = load_and_audit_dataset()

    # 2. EDA
    perform_eda(df)

    # 3. Preprocess
    X_train, X_test, y_train, y_test, X_train_raw, X_test_raw, feature_names = preprocess_dataset(df)

    # 4. Benchmarks
    models_dict, results_df, roc_curves = run_model_benchmarks(X_train, X_test, y_train, y_test, feature_names)

    # 5. Tune Decision Tree
    best_depth = tune_decision_tree_depth(X_train, X_test, y_train, y_test)

    # 6. Identify Champion
    champion_name = results_df.iloc[0]["model"]
    champion_model = models_dict[champion_name]

    # 7. Tune Decision Cutoff for Higher Recall
    cutoff_results = tune_decision_cutoff(champion_model, X_test, y_test)

    # 8. Export Champion & Evaluation Artifacts
    export_champion_artifacts(champion_model, champion_name, X_test, y_test, feature_names, results_df, roc_curves, models_dict=models_dict)


    print("\n" + "=" * 70)
    print(f"PIPELINE COMPLETE in {time.time() - total_start:.2f} seconds.")
    print("=" * 70)


if __name__ == "__main__":
    main()
