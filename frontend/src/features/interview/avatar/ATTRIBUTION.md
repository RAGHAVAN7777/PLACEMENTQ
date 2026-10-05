# Aria geometry

`aria-bust.bin` is a cropped and reshaped human bust derived from the MakeHuman
community's `hm08` base mesh and its adult female morphology targets. These
graphical assets are **CC0 1.0 Universal**, separately from MakeHuman's AGPL
application code. No MakeHuman program code is included or used by the app.

- Source: https://github.com/makehumancommunity/makehuman
- Source revision: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`
- Official licensing explanation: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
- Asset dedication: `LICENSE-CC0.txt` in this folder
- Original mesh credits: Data Collection AB, Joel Palmius, Jonas Hauquier
- Original morphology credit: Manuel Bastioni and the MakeHuman contributors

The build helper `build_asset.py` reconstructs the bundled binary using the
original mesh and four weighted morphology targets. It keeps only the head,
neck, shoulders and upper chest; the chest is smoothed into an abstract suit
volume. The app needs no connection to MakeHuman or a CDN at runtime.

The custom renderer samples the sculpted mesh into particles and deforms the
actual vertices for speech, blinking, expressions, gaze and breathing. The
browser speech engine exposes word boundaries rather than audio phoneme
alignment: Aria uses those events and an estimated intra-word viseme schedule.
This is expressive, speech-driven animation, not studio-grade forced alignment.
