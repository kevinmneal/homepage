"""Copy a committed All the Ways to Fit release, or verify the saved snapshot.

Update: python3 scripts/sync-tiling-playground.py --source /path/to/all-the-ways-to-fit
Verify: python3 scripts/sync-tiling-playground.py --check
Uses only the standard library; updates read Git objects from the local checkout.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs/lab/all-the-ways-to-fit'
MANIFEST = ROOT / 'scripts/all-the-ways-to-fit.snapshot.json'
UPSTREAM = 'https://github.com/kevinmneal/all-the-ways-to-fit'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def check():
    snapshot = json.loads(MANIFEST.read_text())
    actual = {str(path.relative_to(DEST)): digest(path.read_bytes())
              for path in DEST.rglob('*') if path.is_file()}
    if actual != snapshot['files']:
        raise SystemExit('Playground files differ from the saved snapshot. Resync from its source repository.')
    print(f"Verified {len(actual)} playground files from {snapshot['revision']}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--source', type=Path, help='Local source repository; copies its committed HEAD')
    mode.add_argument('--check', action='store_true', help='Verify the saved snapshot without a source checkout')
    args = parser.parse_args()
    if args.check:
        check()
        return

    def git(*arguments):
        return subprocess.check_output(['git', '-C', str(args.source), *arguments])

    if git('status', '--porcelain', '--', 'dist', 'LICENSE').strip():
        raise SystemExit('Commit the source dist/ and LICENSE changes before synchronizing.')
    revision = git('rev-parse', 'HEAD').decode().strip()
    paths = git('ls-tree', '-r', '--name-only', revision, '--', 'dist', 'LICENSE').decode().splitlines()
    if 'dist/index.html' not in paths or 'LICENSE' not in paths:
        raise SystemExit('Source must contain a committed dist/index.html and LICENSE.')
    files = {}
    for name in paths:
        relative = name.removeprefix('dist/')
        data = git('show', f'{revision}:{name}')
        destination = DEST / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        files[relative] = digest(data)
    MANIFEST.write_text(json.dumps({
        'repository': UPSTREAM,
        'revision': revision,
        'files': dict(sorted(files.items())),
    }, indent=2) + '\n')
    check()


if __name__ == '__main__':
    main()
