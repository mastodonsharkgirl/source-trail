"""Development-only calibration using the shared selector and threshold function."""
import argparse
import copy
import re
import sys
import time
from .contracts import strict_json
from .ollama import LocalOllamaClient, OPTIONS
from .runner import EVIDENCE, REPO, RunStore, bounded_process, encode, git, now, prepare_cases, prompt_identity, require_committed, save_contexts, sha256, validate_contexts, write_once


def calibrate_development(fixture, fixture_hash, contexts, source_commit):
    cases = fixture['development']
    if len(cases) != 12 or not re.fullmatch(r'[a-f0-9]{40}', source_commit):
        raise ValueError('Calibration requires the frozen development split and source commit')
    validate_contexts(contexts, fixture, cases, fixture_hash)
    by_id = {case['caseId']: case for case in contexts['cases']}
    rows = []
    for case in cases:
        semantic = next(s for s in by_id[case['caseId']]['selections'] if s['method'] == 'semantic')
        rows.append({'caseId': case['caseId'], 'topScore': semantic['ranked'][0]['score'] if semantic['ranked'] else None, 'hasEvidence': bool(case['relevantIds'])})
    result = strict_json(bounded_process(['node', '--experimental-strip-types', 'scripts/policy-calibration.mjs'], encode({'schemaVersion': 1, 'rows': rows}), REPO))
    return {**result, 'fixtureHash': fixture_hash, 'sourceCommit': source_commit, 'retrievalSha256': sha256(encode(contexts)), 'selectionThresholdForCollection': -1.01, 'notice': 'Development-only evidence-presence calibration; never an answer-support score. No generation uses the provisional collection gate.'}


def frozen_inputs():
    files = {name: (EVIDENCE / name).read_bytes() for name in ('fixture.json', 'rubric.json', 'manifest.json')}
    fixture, manifest = strict_json(files['fixture.json']), strict_json(files['manifest.json'])
    if sha256(files['fixture.json']) != manifest['fixtureSha256'] or sha256(files['rubric.json']) != manifest['rubricSha256']:
        raise ValueError('Frozen fixture/rubric hashes changed')
    require_committed(files, lambda name: git('show', f'HEAD:docs/policy-lab/{name}'))
    if git('status', '--porcelain', '--untracked-files=no').strip():
        raise ValueError('Tracked source must be clean before calibration')
    return fixture, manifest, git('rev-parse', 'HEAD').decode().strip()


def prepare_development():
    fixture, manifest, source_commit = frozen_inputs()
    if any((EVIDENCE / name).exists() for name in ('calibration.json', 'protocol.json', 'development-retrieval.json', 'development-retrieval-started.json')):
        raise ValueError('Development calibration is already started or recorded; refusing an automatic rerun')
    started_path = EVIDENCE / 'development-retrieval-started.json'
    write_once(started_path, {'sourceCommit': source_commit, 'fixtureHash': manifest['fixtureSha256'], 'startedAt': now(), 'split': 'development', 'caseCount': 12})
    print('Preparing the 12 development inputs with real local MiniLM, one CPU thread.', flush=True)
    try:
        contexts = prepare_cases(fixture, fixture['development'], manifest['fixtureSha256'], -1.01)
        save_contexts(EVIDENCE / 'development-retrieval.json', contexts)
        calibration = calibrate_development(fixture, manifest['fixtureSha256'], contexts, source_commit)
        write_once(EVIDENCE / 'calibration.json', calibration)
        metadata = LocalOllamaClient().preflight()
        write_once(EVIDENCE / 'local-model-preflight.json', {**metadata, 'recordedAt': now(), 'sourceCommit': source_commit})
        protocol = {'schemaVersion': 1, 'fixtureHash': manifest['fixtureSha256'], 'rubricHash': manifest['rubricSha256'], 'threshold': calibration['threshold'], 'modelDigest': metadata['digest'], 'templateSha256': metadata['templateSha256'], 'promptSha256': prompt_identity(), 'calibrationSha256': sha256((EVIDENCE / 'calibration.json').read_bytes()), 'locked': False, 'options': copy.deepcopy(OPTIONS), 'methodOrder': 'cyclic', 'developmentAdjustment': None}
        write_once(EVIDENCE / 'protocol.json', protocol)
        print(f"Development gate calibrated at {calibration['threshold']}; protocol prepared without a generation call.", flush=True)
        return 0
    except BaseException as error:
        write_once(EVIDENCE / f'development-preparation-error-{time.time_ns()}.json', {'recordedAt': now(), 'type': type(error).__name__, 'message': str(error), 'sourceCommit': source_commit})
        raise


def lock_protocol():
    fixture, manifest, _ = frozen_inputs()
    with RunStore(EVIDENCE / 'runs') as store:
        store.require_stage_ready('held-out', fixture['version'])
        path = EVIDENCE / 'protocol.json'
        original = path.read_bytes(); protocol = strict_json(original)
        if protocol['fixtureHash'] != manifest['fixtureSha256'] or protocol['calibrationSha256'] != sha256((EVIDENCE / 'calibration.json').read_bytes()):
            raise ValueError('Cannot lock changed fixture/calibration')
        if protocol['locked'] is True:
            print('Protocol already locked; commit its exact bytes before held-out.', flush=True)
            return 0
        history = EVIDENCE / 'protocol-variants'; history.mkdir(exist_ok=True)
        archive = history / f'{sha256(original)}.json'
        if not archive.exists(): write_once(archive, original)
        protocol['locked'] = True
        path.write_bytes(encode(protocol))
    print('Protocol locked. Commit it before the single held-out sweep.', flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser(description='Prepare actual development-only Policy Lab calibration or lock a finished protocol, locally')
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--development', action='store_true')
    action.add_argument('--lock', action='store_true')
    args = parser.parse_args()
    try: return prepare_development() if args.development else lock_protocol()
    except (OSError, ValueError, RuntimeError) as error: parser.exit(1, f'Policy preparation stopped: {error}\n')


if __name__ == '__main__': sys.exit(main())
