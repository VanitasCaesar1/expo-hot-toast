#!/usr/bin/env python3
"""
Cuts the CI recordings of the scripted rich-toast demo into the website's media.

    python3 website/scripts/cut-rich.py <artifacts-dir>

<artifacts-dir> holds what `gh run download` gives for the iOS and Android
runs: `ios-smoke/rich-{dark,light}.mp4` and `android-smoke/rich-{dark,light}.mp4`
(recorded around demo-rich.yaml, which long-presses the subtitle to start
playRichDemo in example/App.tsx).

START is where the long-press lands in each file: step through frames until the
upload toast ("Uploading 4 photos") appears and subtract 0.8 s (playRichDemo
fires it at 800 ms). Update per CI run.

Writes to website/public/media:
  <platform>-rich-<scheme>.mp4   the demo, H.264, 720 px wide
  <platform>-rich-<scheme>.jpg   its poster: the upload part way
Needs ffmpeg on PATH.
"""

import subprocess
import sys
from pathlib import Path

START = {
    ('ios', 'dark'): None,
    ('ios', 'light'): None,
    ('android', 'dark'): None,
    ('android', 'light'): None,
}
# The banner, last, appears at 22 s for 2.6 s.
LENGTH = 25.4
# Into the demo for the poster: the upload bar part way across.
POSTER_AT = 2.2
WIDTH = 720

MEDIA = Path(__file__).resolve().parent.parent / 'public' / 'media'


def ffmpeg(*args: str) -> None:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def cut(src: Path, platform: str, scheme: str, start: float) -> None:
    base = MEDIA / f'{platform}-rich-{scheme}'
    ffmpeg(
        '-ss', f'{start + 0.4}', '-i', str(src), '-t', f'{LENGTH}',
        '-vf', f'fps=30,scale={WIDTH}:-2:flags=lanczos',
        '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        f'{base}.mp4',
    )
    ffmpeg(
        '-ss', f'{start + POSTER_AT}', '-i', str(src), '-frames:v', '1',
        '-vf', f'scale={WIDTH}:-2:flags=lanczos', '-q:v', '4',
        f'{base}.jpg',
    )


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = Path(sys.argv[1])
    MEDIA.mkdir(parents=True, exist_ok=True)
    for (platform, scheme), start in START.items():
        src = root / f'{platform}-smoke' / f'rich-{scheme}.mp4'
        if start is None or not src.exists():
            print(f'skip {platform} {scheme}')
            continue
        cut(src, platform, scheme, start)
        print(f'cut {platform} {scheme} from {start}s')


if __name__ == '__main__':
    main()
