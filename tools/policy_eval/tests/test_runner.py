import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

from tools.policy_eval.tests.helpers import DIGEST, INPUT, PASSAGE, SyntheticTransport, prepared, fixture

PROTOCOL = {"runId": "synthetic-run", "fixtureHash": "f" * 64, "protocolHash": "e" * 64, "modelDigest": DIGEST}


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("tools.policy_eval.runner"), "persistent runner is not implemented")
        from tools.policy_eval import runner
        from tools.policy_eval.ollama import LocalOllamaClient
        self.runner = runner
        self.transport = SyntheticTransport()
        self.client = LocalOllamaClient(transport=self.transport)

    def test_success_records_request_before_call_wire_before_validation(self):
        saved = {}

        def record(name, data):
            self.assertNotIn(name, saved)
            saved[name] = copy.deepcopy(data)

        def transport(method, path, body):
            if path == "/api/generate":
                self.assertIn("request.json", saved)
                self.assertIn("attempt.json", saved)
            return self.transport(method, path, body)

        from tools.policy_eval.ollama import LocalOllamaClient
        row = self.runner.run_case(prepared(), "semantic", PROTOCOL, LocalOllamaClient(transport=transport), record=record)
        self.assertEqual(row["status"], "completed")
        self.assertEqual(row["runtime"]["generatorCalls"], 1)
        self.assertIsNone(row["assessment"])
        self.assertEqual(row["selection"]["timings"]["corpusEmbeddingMs"], 2)
        self.assertIn("response.bin", saved)
        self.assertEqual(saved["output.json"]["rawResponse"], self.transport.generated["response"])

    def test_timeout_and_interruption_remain_visible_without_retry(self):
        for failure, status in [(TimeoutError("synthetic timeout"), "runtime_error"), (KeyboardInterrupt(), "interrupted")]:
            self.transport.requests.clear()
            self.transport.failure = failure
            saved = {}
            row = self.runner.run_case(prepared(), "semantic", PROTOCOL, self.client, record=lambda n, d: saved.update({n: d}))
            self.assertEqual(row["status"], status)
            self.assertEqual(row["runtime"]["generatorCalls"], 1)
            self.assertIsNone(row["parsedResponse"])
            self.assertIn("attempt.json", saved)
            self.assertIn("output.json", saved)
            self.assertEqual(sum(r[1] == "/api/generate" for r in self.transport.requests), 1)

    def test_gate_skip_has_no_calls_and_null_generator_timings(self):
        data = prepared()
        data["selections"][1].update(supplied=[], gate="abstain", gateReason="below threshold")
        row = self.runner.run_case(data, "semantic", PROTOCOL, self.client)
        self.assertEqual(row["status"], "gate_abstained")
        self.assertEqual(row["runtime"]["generatorCalls"], 0)
        self.assertIsNone(row["runtime"]["generationMs"])
        self.assertFalse(self.transport.requests)
        self.assertTrue(row["selection"]["ranked"])

    def test_context_overflow_keeps_full_context_without_a_call(self):
        data = prepared()
        passage = data["selections"][2]["supplied"][0]
        passage.update(text="x" * 6500, end=6500)
        row = self.runner.run_case(data, "full-context", PROTOCOL, self.client)
        self.assertEqual(row["status"], "context_error")
        self.assertEqual(len(row["selection"]["supplied"][0]["text"]), 6500)
        self.assertFalse(self.transport.requests)

    def test_invalid_json_retains_raw_without_parser_repair(self):
        self.transport.generated["response"] = "```json invalid synthetic answer```"
        row = self.runner.run_case(prepared(), "lexical", PROTOCOL, self.client)
        self.assertEqual(row["status"], "validation_error")
        self.assertEqual(row["rawResponse"], self.transport.generated["response"])
        self.assertIsNone(row["parsedResponse"])

    def test_prepare_sends_no_gold_and_checks_returned_identity(self):
        doc = {k: v for k, v in PASSAGE.items() if k not in ("sourceId", "start", "end", "documentSha256")}
        doc["id"] = PASSAGE["sourceId"]
        fixture = {"documents": [doc]}
        case = {"caseId": "synthetic-case", "input": INPUT, "answerable": True, "requiredFacts": ["never send this"]}

        def invoke(request):
            parsed = json.loads(request)
            self.assertEqual(set(parsed["cases"][0]), {"caseId", "input"})
            self.assertNotIn("never send this", request.decode())
            output = prepared()
            import hashlib
            for selection in output["selections"]:
                selection["supplied"][0]["documentSha256"] = hashlib.sha256(doc["text"].encode()).hexdigest()
            return json.dumps({"schemaVersion": 1, "fixtureHash": "f" * 64, "cases": [output], "encoder": {"synthetic": True}}).encode()

        result = self.runner.prepare_cases(fixture, [case], "f" * 64, .5, invoke=invoke)
        self.assertEqual(result["cases"][0]["caseId"], "synthetic-case")
        for field, replacement in [("fixtureHash", "c" * 64), ("cases", []), ("schemaVersion", 2)]:
            def bad(request):
                output = json.loads(invoke(request))
                output[field] = replacement
                return json.dumps(output).encode()
            with self.assertRaises(ValueError):
                self.runner.prepare_cases(fixture, [case], "f" * 64, .5, invoke=bad)

    def test_saved_contexts_are_revalidated_and_hash_bound_on_resume(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "contexts.json"
            contexts = {"schemaVersion": 1, "fixtureHash": "f" * 64, "cases": [prepared()], "encoder": {"synthetic": True}}
            self.runner.save_contexts(path, contexts)
            self.assertEqual(self.runner.read_contexts(path, "f" * 64, [{"caseId": "synthetic-case", "input": INPUT}], fixture()), contexts)
            with self.assertRaises(ValueError):
                self.runner.read_contexts(path, "c" * 64, [{"caseId": "synthetic-case", "input": INPUT}], fixture())
            altered = copy.deepcopy(contexts)
            altered["cases"][0]["input"]["query"] = "altered"
            path.write_bytes(json.dumps(altered).encode())
            with self.assertRaises(ValueError):
                self.runner.read_contexts(path, "f" * 64, [{"caseId": "synthetic-case", "input": INPUT}], fixture())

    def test_stage_order_requires_successful_smoke_and_finished_development(self):
        with tempfile.TemporaryDirectory() as temp, self.runner.RunStore(Path(temp)) as store:
            with self.assertRaises(ValueError):
                store.require_stage_ready("development", "synthetic-fixture-v1")
            smoke = self.allocate(store, "smoke", "smoke")
            for row in smoke["rows"]:
                record = store.start_row("smoke", row)
                record("output.json", {"status": "completed"})
            store.require_stage_ready("development", "synthetic-fixture-v1")
            with self.assertRaises(ValueError):
                store.require_stage_ready("held-out", "synthetic-fixture-v1")
            development = self.allocate(store, "development", "dev")
            for row in development["rows"]:
                record = store.start_row("dev", row)
                record("output.json", {"status": "validation_error"})
            store.require_stage_ready("held-out", "synthetic-fixture-v1")

    def test_malformed_preparation_does_not_leak_gold_or_replace_context(self):
        data = prepared()
        data["selections"][1]["supplied"][0]["extra"] = "scorer-only"
        with self.assertRaises(ValueError):
            self.runner.run_case(data, "semantic", PROTOCOL, self.client)
        self.assertFalse(self.transport.requests)

    def test_bounded_subprocess_observes_output_limit_exit_status_and_timeout(self):
        result = self.runner.bounded_process([sys.executable, "-c", "import sys; sys.stdout.buffer.write(sys.stdin.buffer.read())"], b"synthetic", Path.cwd(), limit=32, timeout=2)
        self.assertEqual(result, b"synthetic")
        for script in ["print('x'*100)", "raise SystemExit(2)", "import time; time.sleep(1)"]:
            with self.subTest(script=script), self.assertRaises(ValueError):
                self.runner.bounded_process([sys.executable, "-c", script], b"", Path.cwd(), limit=32, timeout=.15)

    def test_invalid_run_ids_never_become_paths(self):
        for value in ("../bad", "C:/bad", "UPPER", "", "a" * 81, "-bad"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.runner.validate_run_id(value)

    def allocate(self, store, stage, run_id, protocol="e" * 64, resume=False, source="a" * 40):
        ids = [f"synthetic-{i}" for i in range(24 if stage == "held-out" else 12)]
        return store.allocate(stage, run_id, "synthetic-fixture-v1", "f" * 64, protocol, ids, source_commit=source, resume=resume)

    def test_resume_refuses_different_source_commit_or_saved_protocol_bytes(self):
        protocol_bytes = b'{"synthetic":true}\n'
        import hashlib
        digest = hashlib.sha256(protocol_bytes).hexdigest()
        with tempfile.TemporaryDirectory() as temp, self.runner.RunStore(Path(temp)) as store:
            allocation = self.allocate(store, "smoke", "smoke", protocol=digest)
            provenance = {"sourceCommit": "a" * 40, "sourceDirty": False, "createdAt": "synthetic"}
            self.runner.bind_run_metadata(Path(temp) / "smoke", protocol_bytes, provenance, allocation)
            with self.assertRaises(ValueError):
                self.allocate(store, "smoke", "smoke", protocol=digest, source="b" * 40, resume=True)
            (Path(temp) / "smoke" / "protocol.json").write_bytes(b"changed")
            with self.assertRaises(ValueError):
                self.runner.bind_run_metadata(Path(temp) / "smoke", protocol_bytes, provenance, allocation)

    def test_forged_rank_exclusion_and_rehashed_saved_sources_are_rejected(self):
        cases = [{"caseId": "synthetic-case", "input": INPUT}]
        for mutate in [lambda s: s["ranked"][0].update(id="invented:1"), lambda s: s["excluded"].append({"id": "invented", "reason": "role"}), lambda s: s["supplied"][0].update(documentSha256="e" * 64)]:
            contexts = {"schemaVersion": 1, "fixtureHash": "f" * 64, "cases": [prepared()], "encoder": {"synthetic": True}}
            mutate(contexts["cases"][0]["selections"][0])
            invoke = lambda _: json.dumps(contexts).encode()
            with self.assertRaises(ValueError):
                self.runner.prepare_cases(fixture(), cases, "f" * 64, .5, invoke=invoke)
            with tempfile.TemporaryDirectory() as temp:
                path = Path(temp) / "contexts.json"
                self.runner.save_contexts(path, contexts)  # A matching sidecar alone is insufficient.
                with self.assertRaises(ValueError):
                    self.runner.read_contexts(path, "f" * 64, cases, fixture())

    def test_canonical_identity_retains_repeated_crlf_unicode_source_spans(self):
        source = fixture()
        source["documents"][0]["text"] = "  é🙂\r\n\r\né🙂  "
        passages = self.runner.canonical_passages(source)
        first, second = passages["synthetic-current:1"], passages["synthetic-current:2"]
        self.assertEqual((first["start"], first["end"], first["text"]), (2, 5, "é🙂"))
        self.assertEqual((second["start"], second["end"], second["text"]), (9, 12, "é🙂"))

    def test_development_adjustment_has_auditable_type_and_sequence(self):
        self.runner.validate_development_adjustment(None, 0)
        self.runner.validate_development_adjustment("Development case X showed missing context; threshold changed.", 1)
        for value, count in [("unsolicited adjustment", 0), (True, 1), (1, 1), ({"note": "vague"}, 1), (None, 1), ("  ", 1)]:
            with self.subTest(value=value, count=count), self.assertRaises(ValueError):
                self.runner.validate_development_adjustment(value, count)

    def test_persistent_allocation_limits_span_protocol_variants(self):
        with tempfile.TemporaryDirectory() as temp:
            for stage, allowed in (("smoke", 1), ("development", 2), ("held-out", 1)):
                for index in range(allowed):
                    with self.runner.RunStore(Path(temp)) as store:
                        allocation = self.allocate(store, stage, f"{stage}-{index}", protocol=str(index) * 64)
                        self.assertEqual(len(allocation["rows"]), 3 if stage == "smoke" else (72 if stage == "held-out" else 36))
                with self.runner.RunStore(Path(temp)) as store, self.assertRaises(ValueError):
                    self.allocate(store, stage, f"{stage}-extra", protocol="d" * 64)
            allocations = list(Path(temp).glob("budgets/synthetic-fixture-v1/*.json"))
            self.assertEqual(sum(len(json.loads(p.read_text())["rows"]) for p in allocations), 147)

    def test_resume_allows_only_preallocated_never_started_rows(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.runner.RunStore(Path(temp)) as store:
                allocation = self.allocate(store, "held-out", "held")
                first = allocation["rows"][0]
                record = store.start_row("held", first)
                record("attempt.json", {"synthetic": True})
            with self.runner.RunStore(Path(temp)) as store:
                again = self.allocate(store, "held-out", "held", resume=True)
                self.assertEqual(again, allocation)
                self.assertEqual(store.row_state("held", first), "interrupted")
                with self.assertRaises(FileExistsError):
                    store.start_row("held", first)
                record = store.start_row("held", allocation["rows"][1])
                record("output.json", {"status": "gate_abstained"})
                with self.assertRaises(FileExistsError):
                    record("output.json", {"status": "completed"})
                with self.assertRaises(ValueError):
                    self.allocate(store, "held-out", "held", protocol="c" * 64, resume=True)
                with self.assertRaises(ValueError):
                    store.start_row("held", {"caseId": "unallocated", "method": "lexical"})

    def test_lock_prevents_two_runners_from_using_same_budget(self):
        with tempfile.TemporaryDirectory() as temp, self.runner.RunStore(Path(temp)):
            with self.assertRaises(ValueError):
                with self.runner.RunStore(Path(temp)):
                    self.fail("Second writer acquired the experiment lock")

    def test_heldout_requires_committed_matching_fixture_protocol_calibration(self):
        files = {"fixture.json": b"fixture", "rubric.json": b"rubric", "manifest.json": b"manifest", "protocol.json": b"protocol", "calibration.json": b"calibration"}
        for missing in files:
            with self.subTest(missing=missing), self.assertRaises(ValueError):
                self.runner.require_committed(files, lambda name: b"changed" if name == missing else files[name])
        self.runner.require_committed(files, lambda name: files[name])
