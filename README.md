# 🎓 PlacementIQ (PLACEMENTQ)
### Machine Learning Course Project: Student Placement Intelligence & Outcome Prediction

PlacementIQ is an end-to-end Machine Learning research project and decision-support web platform that analyzes student academic, skill, experience, and extracurricular attributes to forecast campus placement outcomes and prescribe actionable preparation roadmaps.

---

## 📌 Project Highlights & Core Novelties

- **Dataset Scale:** 100,000 student records across 26 features ([student_placement_prediction_dataset_2026.csv](student_placement_prediction_dataset_2026.csv)) with zero missing values.
- **Forensic Leakage Elimination:** Audited and strictly removed target data leakage (`salary_package_lpa` and surrogate identifier `student_id`).
- **Domain Feature Engineering:** Formulated 8 non-linear domain composite features (Technical Core Index, Coding*CGPA interaction, Backlog Risk Ratio, etc.), expanding feature space to 31 predictors.
- **Curriculum Alignment across 12 Models:** Implemented and benchmarked 12 models across 4 families (Linear, SVM, Decision Trees, Ensembles including XGBoost, HistGradientBoosting, and Stacking with out-of-fold cross-validation).
- **Champion Performance:** **85.66% Test Accuracy**, **0.9363 ROC-AUC**, **87.12% F1-score** on 20,000 held-out student test records.
- **Bayes Error Rate Analysis:** Proved a 30.27% irreducible noise ceiling via a k-NN (k=9) consistency audit, demonstrating that 85.7% accuracy captures virtually 100% of deterministic signal.
- **Dual Policy Switcher:** Asymmetric cost cutoff optimization (0.50 Corporate Standard vs 0.39 Early Discovery) boosting placement recall to **92.04%** and rescuing 418 borderline students.
- **Prescriptive Counterfactual Optimizer:** Inverts classification to calculate the minimal effort perturbation vector `delta-x`, generating 3 actionable paths (Quick Wins, Technical Acceleration, Holistic Growth).
- **Full-Stack Application:** Production React 19 + TypeScript + Three.js web application with an institutional **Model Lab** documenting evaluation metrics.

---

## 📊 Comparative Model Benchmark (N=20,000 Test Records)

| Rank | Model Architecture | Accuracy (%) | Precision (%) | Recall (%) | F1-Score (%) | ROC-AUC | Train Time |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| 🥇 | **HistGradientBoosting** *(Champion)* | **85.66%** | **86.04%** | **88.24%** | **87.12%** | **0.9363** | 5.64s |
| 🥈 | **XGBoost (depth=6, lr=0.05)** | 85.56% | 85.60% | 88.65% | 87.10% | **0.9367** | 1.85s |
| 🥉 | **Stacking Classifier (Meta: LogReg)** | 85.47% | 85.84% | 88.10% | 86.96% | 0.9364 | 48.19s |
| 4 | **Soft Voting Ensemble (RF+HGB+XGB)** | 85.37% | 85.44% | 88.47% | 86.93% | 0.9358 | 15.57s |
| 5 | **Linear Support Vector Machine** | 85.13% | 84.98% | 88.63% | 86.77% | 0.9319 | 1.53s |
| 6 | **Logistic Regression** | 85.08% | 85.08% | 88.36% | 86.69% | 0.9318 | 0.42s |
| 7 | **Random Forest (150 trees)** | 84.63% | 84.33% | 88.50% | 86.36% | 0.9286 | 5.66s |
| 8 | **Bagging (Decision Tree)** | 84.20% | 84.00% | 88.04% | 85.97% | 0.9223 | 12.93s |
| 9 | **Decision Tree (Gini Impurity, d=8)** | 82.92% | 82.31% | 87.81% | 84.97% | 0.9099 | 3.65s |
| 10 | **Decision Tree (Shannon Entropy, d=8)** | 82.76% | 83.62% | 85.38% | 84.49% | 0.9095 | 3.35s |
| 11 | **Perceptron (Linear LTU)** | 82.64% | 83.59% | 85.15% | 84.36% | 0.9087 | 0.27s |
| 12 | **AdaBoost (100 stumps)** | 79.42% | 78.23% | 86.72% | 82.26% | 0.8968 | 42.85s |
| — | *Majority-Class Dummy Baseline* | *55.00%* | — | — | — | *0.5000* | — |

---

## 📁 Repository Structure & Key Documents

- [`PROFESSOR_EXPLANATION_GUIDE.md`](PROFESSOR_EXPLANATION_GUIDE.md): **The complete viva defense, presentation script, novelty guide, and professor FAQ.**
- [`ML_PROJECT_REPORT.md`](ML_PROJECT_REPORT.md): Formal academic course research paper.
- [`PROJECT_WORK_SUMMARY.md`](PROJECT_WORK_SUMMARY.md): End-to-end technical work log and chronological milestones.
- [`placement_prediction_course_project.ipynb`](placement_prediction_course_project.ipynb): 31-cell interactive Jupyter Notebook reproducing all experiments and plots.
- [`ml/train.py`](ml/train.py): Automated training, benchmark, and artifact export script.
- [`frontend/`](frontend/): React 19 + TypeScript web application with Model Lab, Scenario Sandbox, and Counterfactual Optimizer.

---

## 🚀 How to Run the Project

### 1. Run the Machine Learning Pipeline
Ensure Python 3.10+ is installed:
```bash
# Run automated multi-model training & evaluation
python ml/train.py
```
This retrains all 12 models, regenerates the benchmark CSV, saves evaluation plots to `ml/plots/`, and exports `ml/models/placement_model.joblib`.

### 2. Run the Interactive Jupyter Notebook
Open [`placement_prediction_course_project.ipynb`](placement_prediction_course_project.ipynb) in VS Code, Jupyter Lab, or Google Colab:
```bash
jupyter notebook placement_prediction_course_project.ipynb
```

### 3. Run the Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser and explore the **Overview**, **Model Lab**, and **Scenario Lab** pages.
