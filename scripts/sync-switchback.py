"""Copy a committed Switchback release, or verify the saved website snapshot.

Update: python3 scripts/sync-switchback.py --source /path/to/switchback-foundry
Verify: python3 scripts/sync-switchback.py --check
Uses only the standard library; updates read Git objects from the local checkout.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs/lab/switchback'
MANIFEST = ROOT / 'scripts/switchback.snapshot.json'
UPSTREAM = 'https://github.com/kevinmneal/switchback-foundry'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def check():
    snapshot = json.loads(MANIFEST.read_text())
    actual = {str(path.relative_to(DEST)): digest(path.read_bytes())
              for path in DEST.rglob('*') if path.is_file()}
    if snapshot['repository'] != UPSTREAM or actual != snapshot['files']:
        raise SystemExit('Switchback files differ from the saved snapshot. Resync from its source repository.')
    print(f"Verified {len(actual)} Switchback files from {snapshot['revision']}.")


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

    previous_files = set()
    if MANIFEST.exists():
        check()
        previous_files = set(json.loads(MANIFEST.read_text())['files'])
    if git('status', '--porcelain', '--', 'dist').strip():
        raise SystemExit('Commit the source dist/ changes before synchronizing.')
    revision = git('rev-parse', 'HEAD').decode().strip()
    paths = git('ls-tree', '-r', '--name-only', revision, '--', 'dist').decode().splitlines()
    required = {'dist/index.html', 'dist/app.mjs', 'dist/model.mjs', 'dist/puzzle.mjs'}
    if not required.issubset(paths):
        raise SystemExit('Source must contain a committed Switchback application in dist/.')
    # Read the complete source before changing the hosted copy.
    payloads = {name.removeprefix('dist/'): git('show', f'{revision}:{name}') for name in paths}
    current = {str(path.relative_to(DEST)) for path in DEST.rglob('*') if path.is_file()}
    obsolete = current - payloads.keys()
    if obsolete - previous_files:
        raise SystemExit('Source omits untracked hosted files. Review them before creating the first snapshot.')
    for name, data in payloads.items():
        destination = DEST / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    for name in obsolete:
        (DEST / name).unlink()
    MANIFEST.write_text(json.dumps({
        'repository': UPSTREAM,
        'revision': revision,
        'files': {name: digest(data) for name, data in sorted(payloads.items())},
    }, indent=2) + '\n')
    check()


if __name__ == '__main__':
    main()
