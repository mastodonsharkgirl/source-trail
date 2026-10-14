import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from tools.policy_eval.tests.test_assessment import gold_case, row, assessment_record
from tools.policy_eval.tests.helpers import DIGEST, PASSAGE, fixture, prepared, SyntheticTransport

PROVENANCE = {"runId": "synthetic-report", "split": "held-out", "fixtureHash": "f" * 64, "rubricHash": "b" * 64, "protocolHash": "e" * 64, "modelDigest": DIGEST, "sourceCommit": "a" * 40, "evidenceKind": "synthetic-test", "attempts": []}


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("tools.policy_eval.report"), "report is not implemented")
        from tools.policy_eval import report
        self.module = report
        self.gold = [gold_case(f"synthetic-{i}", i < 14) for i in range(24)]

    def test_partial_grid_keeps_all_24_cases_and_14_10_denominators(self):
        report = self.module.build_report([row()], self.gold, PROVENANCE)
        metrics = report["metrics"]["semantic"]
        self.assertEqual((metrics["expectedCases"], metrics["answerableTotal"], metrics["abstainExpectedTotal"]), (24, 14, 10))
        self.assertEqual(metrics["answerableAcceptance"], {"numerator": 1, "denominator": 14, "value": 1 / 14})
        self.assertEqual(metrics["supportedAnswerYield"]["numerator"], 0)
        self.assertEqual(metrics["statusCounts"]["missing"], 23)
        self.assertEqual(len(report["rows"]), 72)
        self.assertEqual(report["completion"], "partial")

    def test_macro_recall_and_micro_coverage_are_distinct(self):
        first, second = gold_case("first"), gold_case("second")
        second["relevantIds"] = [PASSAGE["id"], "synthetic:2", "synthetic:3"]
        result = self.module.build_report([row("first"), row("second")], [first, second], {**PROVENANCE, "split": "development"})
        metrics = result["metrics"]["semantic"]
        self.assertAlmostEqual(metrics["recallAt3"]["value"], (1 + 1 / 3) / 2)
        self.assertEqual(metrics["contextCoverageMicro"], {"numerator": 2, "denominator": 4, "value": .5})
        self.assertIsNone(result["metrics"]["full-context"]["recallAt3"])

    def test_zero_denominators_and_no_generation_are_explicitly_unavailable(self):
        result = self.module.build_report([], [gold_case("missing", False)], {**PROVENANCE, "split": "development"})
        self.assertEqual(result["completion"], "unavailable")
        metrics = result["metrics"]["semantic"]
        self.assertEqual(metrics["supportedAnswerYield"], {"numerator": 0, "denominator": 0, "value": None})
        self.assertEqual(metrics["runtime"]["generationMs"], {"n": 0, "p50": None, "p95": None})

    def test_parser_failures_do_not_become_correct_abstentions(self):
        value, gold = row(), gold_case(answerable=False)
        value.update(status="validation_error", rawResponse='{"decision":"abstain"}', parsedResponse=None, validationErrors=["missing fields"])
        metrics = self.module.build_report([value], [gold], {**PROVENANCE, "split": "development"})["metrics"]["semantic"]
        self.assertEqual(metrics["correctAbstention"]["numerator"], 0)
        self.assertEqual(metrics["rawDispositionCounts"]["abstain"], 1)

    def test_gate_latencies_are_not_zero_model_samples_and_ungated_rank_survives(self):
        value = row()
        value.update(status="gate_abstained", rawResponse=None, parsedResponse=None)
        value["selection"].update(supplied=[], gate="abstain", gateReason="below threshold")
        value["runtime"].update(generatorCalls=0, generationMs=None)
        metrics = self.module.build_report([value], [gold_case()], {**PROVENANCE, "split": "development"})["metrics"]["semantic"]
        self.assertEqual(metrics["recallAt3"]["value"], 1)
        self.assertEqual(metrics["contextCoverageMacro"]["value"], 0)
        self.assertEqual(metrics["runtime"]["generationMs"]["n"], 0)

    def test_runtime_percentiles_use_median_and_nearest_rank(self):
        self.assertEqual(self.module.distribution([1, 2, 3, 4]), {"n": 4, "p50": 2.5, "p95": 4})

    def test_boundary_audit_uses_full_fixture_graph_not_selector_exclusions(self):
        original = fixture()["documents"][0]
        replacement = {**copy.deepcopy(original), "id": "replacement", "allowedRoles": ["security"], "supersedes": [original["id"]]}
        forbidden = self.module.forbidden_document_ids([original, replacement], gold_case()["input"])
        self.assertEqual(set(forbidden), {original["id"], "replacement"})
        gold = gold_case()
        gold["forbiddenDocumentIds"] = forbidden
        result = self.module.build_report([row()], [gold], {**PROVENANCE, "split": "development"})
        self.assertEqual(result["metrics"]["semantic"]["contextBoundaryViolations"]["numerator"], 1)

    def test_duplicate_wrong_input_and_hash_tampering_are_rejected(self):
        with self.assertRaises(ValueError):
            self.module.build_report([row(), row()], self.gold, PROVENANCE)
        for mutate in [lambda r: r.update(fixtureHash="c" * 64), lambda r: r["input"].update(query="changed"), lambda r: r["parsedResponse"].update(answer="silently rewritten")]:
            value = row()
            mutate(value)
            with self.assertRaises(ValueError):
                self.module.build_report([value], self.gold, PROVENANCE)

    def test_assessed_support_is_separate_from_valid_citations(self):
        value = row()
        value["assessment"] = assessment_record(value)
        result = self.module.build_report([value], [gold_case()], {**PROVENANCE, "split": "development"})
        self.assertEqual(result["metrics"]["semantic"]["supportedAnswerYield"]["numerator"], 1)

    def test_incoherent_gate_and_relabelled_validation_failure_are_rejected(self):
        for mutate in [lambda r: r.update(status="gate_abstained", rawResponse=None, parsedResponse=None), lambda r: r.update(status="validation_error", parsedResponse=None)]:
            value = row()
            mutate(value)
            with self.assertRaises(ValueError):
                self.module.build_report([value], [gold_case()], {**PROVENANCE, "split": "development"})

    def test_smoke_denominator_uses_only_three_preallocated_pairs(self):
        cases = [gold_case(f"synthetic-{i}") for i in range(3)]
        pairs = [{"caseId": case["caseId"], "method": method} for case, method in zip(cases, ("lexical", "semantic", "full-context"))]
        result = self.module.build_report([], cases, {**PROVENANCE, "split": "smoke", "expectedPairs": pairs})
        self.assertEqual(len(result["rows"]), 3)
        self.assertEqual(result["metrics"]["semantic"]["expectedCases"], 1)

    def test_report_json_and_markdown_are_deterministic(self):
        result = self.module.build_report([row()], self.gold, PROVENANCE)
        with tempfile.TemporaryDirectory() as temp:
            self.module.write_report(result, Path(temp))
            first = (Path(temp) / "report.json").read_bytes()
            self.module.write_report(result, Path(temp))
            self.assertEqual(first, (Path(temp) / "report.json").read_bytes())
            self.assertIn("14", (Path(temp) / "report.md").read_text())

    def test_export_rejects_synthetic_results_and_changed_pointer_hash(self):
        from tools.policy_eval.export import validate_export
        report = self.module.build_report([row()], self.gold, PROVENANCE)
        pointer = {"schemaVersion": 1, "runId": "synthetic-report", "reportSha256": hashlib.sha256(self.module.encode(report)).hexdigest()}
        with self.assertRaises(ValueError):
            validate_export(report, pointer)
        report["provenance"]["evidenceKind"] = "local-runtime"
        with self.assertRaises(ValueError):
            validate_export(report, pointer)

    def create_saved_run(self, root):
        from tools.policy_eval.runner import RunStore, encode, sha256, save_contexts, run_case, bind_run_metadata
        from tools.policy_eval.ollama import LocalOllamaClient
        data = {**fixture(), "version": "synthetic-v1", "development": self.gold[:12], "heldOut": self.gold}
        root.mkdir(exist_ok=True)
        fixture_bytes, rubric_bytes = encode(data), b'{"notice":"synthetic"}\n'
        fixture_hash, rubric_hash = sha256(fixture_bytes), sha256(rubric_bytes)
        (root / "fixture.json").write_bytes(fixture_bytes)
        (root / "rubric.json").write_bytes(rubric_bytes)
        (root / "manifest.json").write_bytes(encode({"schemaVersion": 1, "fixtureSha256": fixture_hash, "rubricSha256": rubric_hash}))
        metadata = LocalOllamaClient(transport=SyntheticTransport()).preflight(DIGEST)
        calibration = {"fixtureHash": fixture_hash, "threshold": .5, "notice": "Synthetic test only"}
        (root / "calibration.json").write_bytes(encode(calibration))
        protocol = {"modelDigest": DIGEST, "templateSha256": metadata["templateSha256"], "fixtureHash": fixture_hash, "rubricHash": rubric_hash, "threshold": .5, "calibrationSha256": sha256(encode(calibration))}
        protocol_bytes = encode(protocol)
        protocol_hash = sha256(protocol_bytes)
        with RunStore(root / "runs") as store:
            allocation = store.allocate("development", "synthetic-report", "synthetic-v1", fixture_hash, protocol_hash, [c["caseId"] for c in self.gold[:12]], source_commit="a" * 40)
            directory = root / "runs" / "synthetic-report"
            bind_run_metadata(directory, protocol_bytes, {"sourceCommit": "a" * 40, "sourceDirty": False, "createdAt": "synthetic", "evidenceKind": "synthetic-test"}, allocation)
            cases = []
            for gold in self.gold[:12]:
                case = prepared()
                case["caseId"] = gold["caseId"]
                cases.append(case)
            save_contexts(directory / "contexts.json", {"schemaVersion": 1, "fixtureHash": fixture_hash, "cases": cases, "encoder": {"synthetic": True}})
            (directory / "model.json").write_bytes(encode(metadata))
            record = store.start_row("synthetic-report", allocation["rows"][0])
            run_case(cases[0], allocation["rows"][0]["method"], {**protocol, "runId": "synthetic-report", "protocolHash": protocol_hash}, LocalOllamaClient(transport=SyntheticTransport()), record=record)
        return directory

    def test_load_recomputes_from_raw_records_and_rejects_changed_saved_answer(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            directory = self.create_saved_run(root)
            result = self.module.load_recorded_run("synthetic-report", evidence_dir=root)
            self.assertEqual(result["completion"], "partial")
            self.assertEqual(len(result["provenance"]["attempts"]), 1)
            output = next(directory.glob("rows/*/output.json"))
            data = json.loads(output.read_bytes())
            data["rawResponse"] += " "
            output.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                self.module.load_recorded_run("synthetic-report", evidence_dir=root)

    def test_started_row_without_output_is_interrupted_not_retried_or_hidden(self):
        from tools.policy_eval.runner import RunStore
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            directory = self.create_saved_run(root)
            allocation = json.loads((directory / "allocation.json").read_bytes())
            with RunStore(root / "runs") as store:
                store.start_row("synthetic-report", allocation["rows"][1])
            result = self.module.load_recorded_run("synthetic-report", evidence_dir=root)
            self.assertEqual(sum(r["status"] == "interrupted" for r in result["rows"]), 1)
            self.assertEqual(len(result["rows"]), 36)

    def test_allocated_directory_before_start_marker_keeps_interrupted_denominator(self):
        from tools.policy_eval.runner import RunStore
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            directory = self.create_saved_run(root)
            pair = json.loads((directory / "allocation.json").read_bytes())["rows"][1]
            with RunStore(root / "runs") as store:
                row_dir = store.row_path("synthetic-report", pair)
                row_dir.mkdir()
                self.assertEqual(store.row_state("synthetic-report", pair), "interrupted")
                with self.assertRaises(FileExistsError):
                    store.start_row("synthetic-report", pair)
            result = self.module.load_recorded_run("synthetic-report", evidence_dir=root)
            value = next(r for r in result["rows"] if r["caseId"] == pair["caseId"] and r["method"] == pair["method"])
            self.assertEqual(len(result["rows"]), 36)
            self.assertEqual(value["status"], "interrupted")
            self.assertEqual(value["runtime"]["generatorCalls"], 0)
            self.assertTrue(value["evidence"]["contextPrepared"])
            self.assertIsNone(value["rawResponse"])
            self.assertIsNone(value["parsedResponse"])
            self.assertIn("start marker", " ".join(value["validationErrors"]).lower())
            self.assertEqual(result["metrics"][pair["method"]]["expectedCases"], 12)

    def create_response_interruption(self, root, wire=None):
        from tools.policy_eval.runner import RunStore, run_case, sha256
        from tools.policy_eval.ollama import LocalOllamaClient
        directory = self.create_saved_run(root)
        pair = json.loads((directory / "allocation.json").read_bytes())["rows"][1]
        protocol_bytes = (directory / "protocol.json").read_bytes()
        protocol = {**json.loads(protocol_bytes), "runId": "synthetic-report", "protocolHash": sha256(protocol_bytes)}
        case = prepared()
        case["caseId"] = pair["caseId"]
        with RunStore(root / "runs") as store:
            save = store.start_row("synthetic-report", pair)
            def interrupted_save(name, data):
                save(name, wire if name == "response.bin" and wire is not None else data)
                if name == "response.bin":
                    raise RuntimeError("Synthetic process stop after durable wire write")
            with self.assertRaisesRegex(RuntimeError, "Synthetic process stop"):
                run_case(case, pair["method"], protocol, LocalOllamaClient(transport=SyntheticTransport()), record=interrupted_save)
            self.assertEqual(store.row_state("synthetic-report", pair), "interrupted")
            with self.assertRaises(FileExistsError):
                store.start_row("synthetic-report", pair)
            row_dir = store.row_path("synthetic-report", pair)
            self.assertFalse((row_dir / "output.json").exists())
        return directory, pair, row_dir

    def test_wire_saved_before_output_keeps_raw_prompt_runtime_without_acceptance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            directory, pair, row_dir = self.create_response_interruption(root)
            wire_bytes = (row_dir / "response.bin").read_bytes()
            wire = json.loads(wire_bytes)
            request = json.loads((row_dir / "request.json").read_bytes())
            result = self.module.load_recorded_run("synthetic-report", evidence_dir=root)
            value = next(r for r in result["rows"] if r["caseId"] == pair["caseId"] and r["method"] == pair["method"])
            self.assertEqual(len(result["rows"]), 36)
            self.assertEqual(value["status"], "interrupted")
            self.assertEqual(value["prompt"], request["body"]["prompt"])
            self.assertEqual(value["rawResponse"], wire["response"])
            self.assertEqual(value["runtime"]["generatorCalls"], 1)
            self.assertEqual(value["runtime"]["generationMs"], wire["eval_duration"] / 1e6)
            self.assertIsNone(value["parsedResponse"])
            self.assertIsNone(value["assessment"])
            self.assertEqual(result["metrics"][pair["method"]]["answerableAcceptance"]["numerator"], 0)
            self.assertEqual((row_dir / "response.bin").read_bytes(), wire_bytes)

    def test_undecodable_interrupted_wire_has_explicit_retained_evidence_diagnostic(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            directory, pair, row_dir = self.create_response_interruption(root, b"\xffsynthetic-broken-wire")
            result = self.module.load_recorded_run("synthetic-report", evidence_dir=root)
            value = next(r for r in result["rows"] if r["caseId"] == pair["caseId"] and r["method"] == pair["method"])
            self.assertEqual(value["status"], "interrupted")
            self.assertIsNone(value["rawResponse"])
            diagnostic = " ".join(value["validationErrors"])
            self.assertIn("retained", diagnostic.lower())
            self.assertIn("response.bin", diagnostic)
            wire_path = (row_dir / "response.bin").relative_to(root).as_posix()
            self.assertIn(wire_path, result["provenance"]["artifactHashes"])
            self.assertEqual(value["runtime"]["generatorCalls"], 1)
            self.assertEqual(len(result["rows"]), 36)

    def test_saved_runtime_cannot_be_changed_independently_of_wire_response(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            directory = self.create_saved_run(root)
            output = next(directory.glob("rows/*/output.json"))
            data = json.loads(output.read_bytes())
            data["runtime"]["generationMs"] = 999
            output.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                self.module.load_recorded_run("synthetic-report", evidence_dir=root)

    def test_missing_generation_keeps_measured_retrieval_but_not_delivery(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.create_saved_run(root)
            result = self.module.load_recorded_run("synthetic-report", evidence_dir=root)
            value = next(r for r in result["rows"] if r["caseId"] == "synthetic-1" and r["method"] == "semantic")
            self.assertEqual(value["status"], "missing")
            self.assertEqual(value["runtime"]["generatorCalls"], 0)
            self.assertEqual(value["selection"]["ranked"][0]["id"], PASSAGE["id"])
            self.assertEqual(value["selection"]["timings"]["queryEmbeddingMs"], 1)
            self.assertFalse(value["evidence"]["modelCallAttempted"])
            self.assertEqual(result["metrics"]["semantic"]["contextCoverageMacro"]["value"], 1)
            self.assertEqual(result["metrics"]["semantic"]["attemptedContextCoverageMacro"]["value"], 0)
            self.assertEqual(result["metrics"]["semantic"]["runtime"]["queryEmbeddingMs"]["n"], 12)
            self.assertEqual(result["metrics"]["semantic"]["recallAt3"]["value"], 1)
            self.assertEqual(result["metrics"]["semantic"]["answerableAcceptance"]["numerator"], 0)

    def test_model_template_and_name_are_bound_to_saved_protocol(self):
        for field, replacement in [("templateSha256", "e" * 64), ("template", "changed bytes"), ("model", "other-model"), ("runtimeVersion", ""), ("details", []), ("modelInfo", {}), ("capabilities", ["completion"])]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                directory = self.create_saved_run(root)
                path = directory / "model.json"
                model = json.loads(path.read_bytes())
                model[field] = replacement
                path.write_text(json.dumps(model))
                with self.assertRaises(ValueError):
                    self.module.load_recorded_run("synthetic-report", evidence_dir=root)

    def test_report_retains_and_binds_actual_calibration_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.create_saved_run(root)
            result = self.module.load_recorded_run("synthetic-report", evidence_dir=root)
            self.assertIn('calibration.json', result['provenance']['artifactHashes'])
            self.assertEqual(result['provenance']['calibration']['threshold'], .5)
            path = root / 'calibration.json'
            changed = json.loads(path.read_bytes()); changed['threshold'] = .7
            path.write_text(json.dumps(changed))
            with self.assertRaises(ValueError):
                self.module.load_recorded_run("synthetic-report", evidence_dir=root)
