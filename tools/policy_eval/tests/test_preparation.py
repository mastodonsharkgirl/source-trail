import copy
import unittest
from tools.policy_eval.tests.helpers import fixture, prepared, PASSAGE


class PreparationTests(unittest.TestCase):
    def examples(self):
        value = fixture()
        value['development'] = []
        contexts = {'schemaVersion': 1, 'fixtureHash': 'f' * 64, 'encoder': {'notice': 'Synthetic test only'}, 'cases': []}
        for i in range(12):
            case = prepared(); case['caseId'] = f'synthetic-{i}'
            evidence = i < 6
            next(s for s in case['selections'] if s['method'] == 'semantic')['ranked'][0]['score'] = .8 if evidence else .2
            value['development'].append({'caseId': case['caseId'], 'input': copy.deepcopy(case['input']), 'relevantIds': [PASSAGE['id']] if evidence else [], 'answerable': False})
            contexts['cases'].append(case)
        value['heldOut'] = [{'caseId': 'must-never-enter-calibration', 'input': {'query': 'held-out canary'}}]
        return value, contexts

    def test_calibration_uses_development_evidence_presence_and_shared_threshold(self):
        from tools.policy_eval.preparation import calibrate_development
        fixture, contexts = self.examples()
        result = calibrate_development(fixture, 'f' * 64, contexts, 'a' * 40)
        self.assertEqual(result['threshold'], .8)
        self.assertEqual(result['balancedAccuracy'], 1)
        self.assertEqual(len(result['rows']), 12)
        self.assertTrue(result['rows'][0]['hasEvidence'])  # conflict evidence is present despite answerable=False
        self.assertNotIn('held-out canary', str(result))
        self.assertTrue(all(len(c['outcomes']) == 12 for c in result['candidates']))
        self.assertEqual(result['sourceCommit'], 'a' * 40)

    def test_calibration_rejects_changed_fixture_hash_and_case_identity(self):
        from tools.policy_eval.preparation import calibrate_development
        fixture, contexts = self.examples()
        contexts['fixtureHash'] = 'e' * 64
        with self.assertRaises(ValueError): calibrate_development(fixture, 'f' * 64, contexts, 'a' * 40)
        contexts['fixtureHash'] = 'f' * 64
        contexts['cases'][0]['input']['query'] = 'another question'
        with self.assertRaises(ValueError): calibrate_development(fixture, 'f' * 64, contexts, 'a' * 40)


if __name__ == '__main__': unittest.main()
