"""Verify inference transforms against the original training source without fitting anything."""
import ast
import json
import subprocess
import sys
from pathlib import Path
import joblib
import pandas as pd
import numpy as np
root=Path(__file__).resolve().parent.parent
model_dir=root/'ml/models'
values=json.loads((root/'docs/verification/readiness-inputs.json').read_text())['high']
original=ast.parse((root/'ml/train.py').read_text())
function=next(n for n in original.body if isinstance(n,ast.FunctionDef) and n.name=='preprocess_dataset')
# Evaluate only the original X['engineered_feature'] assignments, never fit/train/save code.
assignments=[n for n in function.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Subscript) and isinstance(n.targets[0].value,ast.Name) and n.targets[0].value.id=='X']
X=pd.DataFrame([values])
for key,encoder in joblib.load(model_dir/'label_encoders.joblib').items():X[key]=encoder.transform(X[key].astype(str))
namespace={'X':X,'np':np}
exec(compile(ast.Module(body=assignments,type_ignores=[]),'original-feature-engineering','exec'),namespace)
features=joblib.load(model_dir/'feature_names.joblib')
transformed=joblib.load(model_dir/'scaler.joblib').transform(X.loc[:,features])
model=joblib.load(model_dir/'placement_model.joblib')
expected=float(model.predict_proba(transformed)[0,list(model.classes_).index(1)])
actual=json.loads(subprocess.check_output([sys.executable,str(root/'ml/infer.py')],input=json.dumps({'inputs':values}).encode()))
assert actual['featureOrder']==features
assert abs(actual['probability']-expected)<1e-12
print(f'Original preprocessing parity passed: {len(features)} ordered features; probability {expected:.15f}; no fit calls.')
