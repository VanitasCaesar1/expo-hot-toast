#!/usr/bin/env python3
"""
Builds the README's recordings: iPhone and Android side by side, one animated
WebP per demo and appearance, from the CI screen recordings.

    python3 scripts/readme-media.py <artifacts-dir>

<artifacts-dir> holds what `gh run download` gives for an iOS and an Android
run: `ios-smoke/{demo,rich}-{dark,light}.mp4` and `android-smoke/...`.

START is where each scripted demo begins in each file (the long-press that
starts it). Find it by stepping through frames: playDemo shows its first toast
at 1.0 s, playRichDemo at 0.8 s. Update per CI run.

Writes docs/media/{demo,rich}-{light,dark}.webp. Needs ffmpeg, img2webp
(brew install webp) and Pillow.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

START = {
    # (demo, platform, scheme): seconds into the recording
    ('demo', 'ios', 'dark'): 46.0,
    ('demo', 'ios', 'light'): 41.5,
    ('rich', 'ios', 'dark'): 32.7,
    ('demo', 'android', 'dark'): 22.9,
    ('demo', 'android', 'light'): 24.4,
    ('rich', 'android', 'dark'): 22.8,
    ('rich', 'android', 'light'): 23.1,
}
LENGTH = {'demo': 24.0, 'rich': 25.0}
FPS = 12
PHONE_W = 300
GAP = 28
PAD = 8
RADIUS = 34

OUT = Path(__file__).resolve().parent.parent / 'docs' / 'media'


def frames(src: Path, start: float, length: float, into: Path) -> list[Path]:
    into.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        # Seek after -i (decode and drop up to `start`): the simulator writes
        # frames only when the screen changes, and seeking before -i into
        # such a file started the clip seconds late.
        ['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-ss', f'{start}', '-t', f'{length}',
         '-vf', f'fps={FPS},scale={PHONE_W}:-2:flags=lanczos', str(into / 'f%04d.png')],
        check=True,
    )
    return sorted(into.glob('f*.png'))


def rounded(im: Image.Image) -> Image.Image:
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), RADIUS, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im.convert('RGB'), (0, 0), mask)
    return out


def build(root: Path, demo: str, scheme: str) -> None:
    ios_start = START.get((demo, 'ios', scheme))
    android_start = START.get((demo, 'android', scheme))
    if ios_start is None or android_start is None:
        print(f'skip {demo} {scheme}')
        return
    work = Path(tempfile.mkdtemp(prefix='readme-media-'))
    try:
        ios = frames(root / 'ios-smoke' / f'{demo}-{scheme}.mp4', ios_start, LENGTH[demo], work / 'ios')
        android = frames(root / 'android-smoke' / f'{demo}-{scheme}.mp4', android_start, LENGTH[demo], work / 'android')
        count = min(len(ios), len(android))
        first_i, first_a = Image.open(ios[0]), Image.open(android[0])
        height = max(first_i.height, first_a.height) + PAD * 2
        width = PHONE_W * 2 + GAP + PAD * 2
        composed = work / 'out'
        composed.mkdir()
        for n in range(count):
            canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            a = rounded(Image.open(ios[n]))
            b = rounded(Image.open(android[n]))
            canvas.alpha_composite(a, (PAD, PAD))
            canvas.alpha_composite(b, (PAD + PHONE_W + GAP, PAD))
            canvas.save(composed / f'c{n:04d}.png')
        OUT.mkdir(parents=True, exist_ok=True)
        target = OUT / f'{demo}-{scheme}.webp'
        delay = round(1000 / FPS)
        subprocess.run(
            ['img2webp', '-loop', '0', '-lossy', '-q', '62', '-m', '6', '-d', str(delay),
             *sorted(str(p) for p in composed.glob('c*.png')), '-o', str(target)],
            check=True, stdout=subprocess.DEVNULL,
        )
        print(f'wrote {target.name} ({target.stat().st_size // 1024} KB, {count} frames)')
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = Path(sys.argv[1])
    for demo in ('demo', 'rich'):
        for scheme in ('light', 'dark'):
            build(root, demo, scheme)


if __name__ == '__main__':
    main()
