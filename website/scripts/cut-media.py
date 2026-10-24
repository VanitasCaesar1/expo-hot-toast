#!/usr/bin/env python3
"""
Cuts the CI recordings into the website's media.

    python3 website/scripts/cut-media.py <artifacts-dir>

<artifacts-dir> holds what `gh run download` gives for the iOS and Android
runs: `ios-smoke/demo-{dark,light}.mp4` and `android-smoke/demo-{dark,light}.mp4`.

The simulator and emulator recordings run around the whole Maestro flow, so the
scripted demo starts a minute or more into each file, at a different point every
run. START is where the long-press that starts the demo lands in each file; find
it by stepping through frames until the first toast ("Changes saved") appears,
and subtract 1.0 s (playDemo fires it at 1000 ms). Everything in
src/lib/moments.ts is measured from that point.

Writes to website/public/media:
  <platform>-demo-<scheme>.mp4   the demo, 25 s, H.264, 540 px wide
  <platform>-demo-<scheme>.jpg   its poster (the success + error stack)
  <platform>-stack-<scheme>.jpg  a 600x480 still of the top of the screen
Needs ffmpeg on PATH.
"""

import subprocess
import sys
from pathlib import Path

# Seconds into each recording where the demo starts. Update per CI run.
START = {
    ('ios', 'dark'): 91.2,
    ('ios', 'light'): 74.75,
    ('android', 'dark'): None,
    ('android', 'light'): None,
}
# Long enough for the last toast (Message sent, at 21 s, for 2.6 s) to leave.
LENGTH = 25.0
# Seconds into the demo for the poster and still: the error has stacked above
# the success toast, both icons drawn.
STILL_AT = 2.6
WIDTH = 540

MEDIA = Path(__file__).resolve().parent.parent / 'public' / 'media'


def ffmpeg(*args: str) -> None:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def cut(src: Path, platform: str, scheme: str, start: float) -> None:
    base = MEDIA / f'{platform}-demo-{scheme}'
    # The recordings are variable frame rate (the simulator only writes a frame
    # when the screen changes); resample to a steady 30 fps so browsers seek
    # predictably.
    ffmpeg(
        '-ss', f'{start}', '-i', str(src), '-t', f'{LENGTH}',
        '-vf', f'fps=30,scale={WIDTH}:-2:flags=lanczos',
        '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        f'{base}.mp4',
    )
    ffmpeg(
        '-ss', f'{start + STILL_AT}', '-i', str(src), '-frames:v', '1',
        '-vf', f'scale={WIDTH}:-2:flags=lanczos', '-q:v', '4',
        f'{base}.jpg',
    )
    # The still is the top of the screen at the same moment, cropped to 5:4.
    ffmpeg(
        '-ss', f'{start + STILL_AT}', '-i', str(src), '-frames:v', '1',
        '-vf', 'crop=iw:iw*0.8:0:0,scale=600:480:flags=lanczos', '-q:v', '4',
        str(MEDIA / f'{platform}-stack-{scheme}.jpg'),
    )


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = Path(sys.argv[1])
    MEDIA.mkdir(parents=True, exist_ok=True)
    for (platform, scheme), start in START.items():
        src = root / f'{platform}-smoke' / f'demo-{scheme}.mp4'
        if start is None or not src.exists():
            print(f'skip {platform} {scheme}')
            continue
        cut(src, platform, scheme, start)
        print(f'cut {platform} {scheme} from {start}s')


if __name__ == '__main__':
    main()
