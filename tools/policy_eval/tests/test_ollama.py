import importlib.util
import json
import os
import unittest
from unittest.mock import patch

from tools.policy_eval.tests.helpers import DIGEST, SyntheticTransport


class OllamaTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec("tools.policy_eval.ollama"), "local transport is not implemented")
        from tools.policy_eval.ollama import LocalOllamaClient, OllamaError
        self.error = OllamaError
        self.transport = SyntheticTransport()
        self.client = LocalOllamaClient(transport=self.transport)

    def test_request_is_raw_bounded_and_no_tools(self):
        raw = []
        result = self.client.generate("synthetic prompt", DIGEST, on_raw=raw.append)
        request = [r for r in self.transport.requests if r[1] == "/api/generate"][0][2]
        self.assertEqual(request["options"], {"temperature": 0, "seed": 17, "num_predict": 256, "num_ctx": 8192})
        self.assertEqual(request["keep_alive"], "30s")
        self.assertTrue(request["raw"])
        self.assertFalse(request["think"])
        self.assertFalse(request["stream"])
        self.assertNotIn("tools", request)
        self.assertEqual(result["runtime"]["generationMs"], 3)
        self.assertEqual(result["runtime"]["inputTokens"], 40)
        self.assertEqual(len(raw), 1)
        self.assertEqual(json.loads(raw[0])["response"], result["rawResponse"])

    def test_metadata_and_digest_fail_closed_before_generation(self):
        variants = [lambda t: setattr(t, "digest", "short"), lambda t: setattr(t, "digest", "c" * 64), lambda t: t.show["details"].update(family="other"), lambda t: t.show["model_info"].update({"tokenizer.ggml.model": "other"}), lambda t: t.show.update(template="unknown"), lambda t: t.show.update(capabilities=["completion"]), lambda t: t.show["model_info"].update({"qwen3.context_length": 4096})]
        for mutate in variants:
            with self.subTest(mutate=mutate):
                transport = SyntheticTransport()
                mutate(transport)
                from tools.policy_eval.ollama import LocalOllamaClient
                with self.assertRaises(self.error):
                    LocalOllamaClient(transport=transport).generate("test", DIGEST)
                self.assertFalse(any(r[1] == "/api/generate" for r in transport.requests))

    def test_bad_responses_retain_wire_bytes_and_are_failures(self):
        for status, raw in [(302, b"redirect"), (503, b"unavailable"), (200, b"\xff"), (200, b"x" * (1024 * 1024 + 1)), (200, b"not json")]:
            with self.subTest(status=status, size=len(raw)):
                self.transport.status, self.transport.raw = status, raw
                retained = []
                with self.assertRaises(self.error):
                    self.client.generate("test", DIGEST, on_raw=retained.append)
                self.assertTrue(retained)

    def test_length_stop_wrong_model_and_thinking_fail(self):
        for field, value in [("done_reason", "length"), ("done", False), ("model", "other"), ("thinking", "unexpected reasoning")]:
            transport = SyntheticTransport()
            transport.generated[field] = value
            from tools.policy_eval.ollama import LocalOllamaClient
            with self.assertRaises(self.error):
                LocalOllamaClient(transport=transport).generate("test", DIGEST)

    def test_missing_measurements_are_null_with_reason(self):
        self.transport.generated.pop("eval_duration")
        result = self.client.generate("test", DIGEST)
        self.assertIsNone(result["runtime"]["generationMs"])
        self.assertIn("generationMs", result["runtime"]["unavailable"])

    def test_timeout_is_not_retried(self):
        self.transport.failure = TimeoutError("synthetic timeout")
        with self.assertRaises(self.error):
            self.client.generate("test", DIGEST)
        self.assertEqual(sum(r[1] == "/api/generate" for r in self.transport.requests), 1)

    def test_disconnected_service_and_changed_digest_after_generation_fail(self):
        from tools.policy_eval.ollama import LocalOllamaClient
        def offline(*_):
            raise ConnectionRefusedError("synthetic offline service")
        with self.assertRaises(self.error):
            LocalOllamaClient(transport=offline).preflight(DIGEST)
        def changed(method, path, body):
            result = self.transport(method, path, body)
            if path == "/api/generate":
                self.transport.digest = "d" * 64
            return result
        with self.assertRaises(self.error) as error:
            LocalOllamaClient(transport=changed).generate("test", DIGEST)
        self.assertEqual(error.exception.raw_response, self.transport.generated["response"])

    def test_malformed_metadata_and_excess_output_tokens_fail_closed(self):
        from tools.policy_eval.ollama import LocalOllamaClient
        for mutate in [lambda t: t.show.update(capabilities=None), lambda t: t.generated.update(eval_count=257)]:
            transport = SyntheticTransport()
            mutate(transport)
            with self.assertRaises(self.error):
                LocalOllamaClient(transport=transport).generate("test", DIGEST)

    def test_production_ignores_proxy_and_rejects_redirect_without_following(self):
        from tools.policy_eval.ollama import loopback_transport
        with patch.dict(os.environ, {"HTTP_PROXY": "http://invalid-proxy:9"}), patch("http.client.HTTPConnection") as connection:
            response = connection.return_value.getresponse.return_value
            response.status = 302
            response.read1.side_effect = [b"redirect", b""]
            status, body = loopback_transport("GET", "/api/tags", None)
            self.assertEqual(status, 302)
            self.assertEqual(body, b"redirect")
            connection.assert_called_once_with("127.0.0.1", 11434, timeout=120)
            self.assertEqual(connection.return_value.request.call_count, 1)
        with self.assertRaises(ValueError):
            loopback_transport("POST", "/api/pull", {})
