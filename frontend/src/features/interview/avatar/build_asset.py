"""Rebuild the bundled Aria mesh from MakeHuman's CC0 mesh and morphology targets.
Run: python frontend/src/features/interview/avatar/build_asset.py
Only cropped head/shoulders geometry is distributed. No MakeHuman program code is used.
"""
import base64
import json
import math
import os
from pathlib import Path
import struct
import urllib.request

HERE = Path(__file__).resolve().parent
CACHE = Path(os.environ.get('TEMP', '/tmp')) / 'placementiq-aria-assets'
CACHE.mkdir(exist_ok=True)
API = 'https://api.github.com/repos/makehumancommunity/makehuman'

def source(path, filename):
    dest = CACHE / filename
    if not dest.exists():
        req = urllib.request.Request(API + '/contents/' + path, headers={'User-Agent': 'PlacementIQ-avatar-build'})
        with urllib.request.urlopen(req) as response:
            asset = json.load(response)
        if not asset.get('content'):
            with urllib.request.urlopen(API + '/git/blobs/' + asset['sha']) as response:
                asset = json.load(response)
        dest.write_bytes(base64.b64decode(asset['content']))
    return dest.read_text()

vertices, faces = [], []
group = ''
for line in source('makehuman/data/3dobjs/base.obj', 'base.obj').splitlines():
    parts = line.split()
    if not parts: continue
    if parts[0] == 'v': vertices.append(list(map(float, parts[1:4])))
    if parts[0] == 'g': group = parts[1]
    if parts[0] == 'f' and group == 'body':
        face = [int(part.split('/')[0]) - 1 for part in parts[1:]]
        for corner in range(1, len(face) - 1):
            faces.append([face[0], face[corner], face[corner+1]])

morphs = [('asian-female-young', 0.30), ('african-female-young', 0.25),
          ('caucasian-female-young', 0.45), ('universal-female-young-averagemuscle-averageweight', 1.0)]
for name, weight in morphs:
    path = 'makehuman/data/targets/macrodetails/' + name + '.target'
    for line in source(path, name + '.target').splitlines():
        parts = line.split()
        if len(parts) != 4 or parts[0].startswith('#'): continue
        index = int(parts[0])
        for axis in range(3): vertices[index][axis] += float(parts[axis+1]) * weight

# Keep a portrait bust only; remove helper geometry and the remainder of the body.
faces = [face for face in faces if min(vertices[i][1] for i in face) >= 3.65]
indices = sorted(set(index for face in faces for index in face))
remap = {index: new for new, index in enumerate(indices)}
positions = []
for index in indices:
    x, y, z = vertices[index]
    # The lower bust is a smooth, abstract suit-like volume, fading out in the renderer.
    if y < 5.15 and z > 0.40:
        blend = min(1, (5.15-y)/0.9)
        z = z * (1-blend*0.60) + 0.58*blend*0.60
    positions.extend([x, y - 5.55, z - 0.35])
triangles = [remap[index] for face in faces for index in face]
output = struct.pack('<II', len(indices), len(triangles))
output += struct.pack('<' + 'f'*len(positions), *positions)
output += struct.pack('<' + 'H'*len(triangles), *triangles)
(HERE/'aria-bust.bin').write_bytes(output)
print(f'Wrote {len(indices)} vertices, {len(triangles)//3} triangles, {len(output):,} bytes')
