import unittest
import json
from companion import ROOT, run, framework_retrieve

class CompanionTests(unittest.TestCase):
    def test_real_framework_retrieval(self):
        result = run(ROOT/'src/story/atlas.json', 'rabbit bridge sunrise')
        self.assertIn('bridge', [p['id'] for p in result['langchain_passages']])
        self.assertIsNone(result['generation'])
        self.assertTrue(all(p['version']=='1' for p in result['langchain_passages']))

    def test_missing_evidence_and_archived_exclusion(self):
        sources = json.loads((ROOT/'src/story/atlas.json').read_text())['sources']
        self.assertEqual(framework_retrieve(sources, 'quuxxyzzy'), [])
        self.assertNotIn('bridge-old', [p['id'] for p in framework_retrieve(sources, 'bridge night')])

    def test_query_limit(self):
        with self.assertRaises(ValueError):
            run(ROOT/'src/story/atlas.json', 'x'*801)

if __name__ == '__main__':
    unittest.main()
