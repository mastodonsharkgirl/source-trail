"""Fixed loopback transport. No proxies, redirects, pulls, tools or cloud fallback."""
import hashlib
import http.client
import json
import re
import time
from .contracts import ANSWER_SCHEMA, strict_json
from .prompt import validate_prompt_budget

MODEL = "qwen3:1.7b"
OPTIONS = {"temperature": 0, "seed": 17, "num_predict": 256, "num_ctx": 8192}
MAX_RESPONSE = 1024 * 1024
ENDPOINTS = {("GET", "/api/tags"), ("GET", "/api/version"), ("POST", "/api/show"), ("POST", "/api/generate")}


class OllamaError(RuntimeError):
    def __init__(self, message, *, raw_response=None, runtime=None):
        super().__init__(message)
        self.raw_response, self.runtime = raw_response, runtime


def loopback_transport(method, path, body):
    if (method, path) not in ENDPOINTS:
        raise ValueError("Endpoint not permitted")
    # HTTPConnection does not consult proxy environment variables or follow Location.
    connection = http.client.HTTPConnection("127.0.0.1", 11434, timeout=120)
    deadline = time.monotonic() + 120
    chunks, size = [], 0
    try:
        wire = None if body is None else json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        connection.request(method, path, body=wire, headers={"Content-Type": "application/json", "Connection": "close"})
        response = connection.getresponse()
        while size <= MAX_RESPONSE:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Local response deadline exceeded")
            if connection.sock is not None:
                connection.sock.settimeout(remaining)
            chunk = response.read1(min(65536, MAX_RESPONSE + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
        return response.status, b"".join(chunks)
    finally:
        connection.close()


def runtime_fields(value):
    runtime = {"generatorCalls": 1, "returnedModel": value.get("model"), "stopReason": value.get("done_reason"), "unavailable": {}}
    for name, field, scale in [("loadMs", "load_duration", 1e6), ("prefillMs", "prompt_eval_duration", 1e6), ("generationMs", "eval_duration", 1e6), ("totalModelMs", "total_duration", 1e6), ("inputTokens", "prompt_eval_count", 1), ("outputTokens", "eval_count", 1)]:
        number = value.get(field)
        if type(number) is int and number >= 0:
            runtime[name] = number / scale if scale != 1 else number
        else:
            runtime[name] = None
            runtime["unavailable"][name] = f"Runtime did not report a valid {field}"
    for name in ("returnedModel", "stopReason"):
        if runtime[name] is None:
            runtime["unavailable"][name] = "Runtime did not report field"
    return runtime


class LocalOllamaClient:
    def __init__(self, *, transport=None):
        self._transport = transport or loopback_transport

    def _request(self, method, path, body=None, on_raw=None):
        try:
            status, wire = self._transport(method, path, body)
        except (OSError, http.client.HTTPException) as error:
            raise OllamaError(f"Local service request failed ({type(error).__name__}); no retry") from error
        if not isinstance(wire, bytes):
            raise OllamaError("Transport did not return bytes")
        if on_raw:
            on_raw(wire)
        if len(wire) > MAX_RESPONSE:
            raise OllamaError("Local response exceeds 1 MiB")
        if status != 200:
            raise OllamaError(f"Local service HTTP {status}; redirects are not followed")
        try:
            value = strict_json(wire.decode("utf-8", errors="strict"))
        except (UnicodeError, ValueError) as error:
            raise OllamaError("Local response is not strict UTF-8 JSON") from error
        if not isinstance(value, dict) or "error" in value:
            raise OllamaError("Local service returned an invalid envelope or error")
        return value

    def preflight(self, expected_digest=None):
        tags = self._request("GET", "/api/tags")
        models = tags.get("models")
        if not isinstance(models, list):
            raise OllamaError("Missing installed-model inventory")
        matches = [m for m in models if isinstance(m, dict) and m.get("name") == MODEL]
        if len(matches) != 1:
            raise OllamaError("Required local model is not uniquely installed; auto-pull is disabled")
        digest = matches[0].get("digest")
        if not isinstance(digest, str) or not re.fullmatch(r"(?:sha256:)?[a-f0-9]{64}", digest) or (expected_digest is not None and digest != expected_digest):
            raise OllamaError("Installed model digest is missing, invalid or changed")
        show = self._request("POST", "/api/show", {"model": MODEL})
        info, details, template = show.get("model_info", {}), show.get("details", {}), show.get("template")
        if not isinstance(info, dict) or not isinstance(details, dict) or details.get("family") != "qwen3" or info.get("general.architecture") != "qwen3" or info.get("tokenizer.ggml.model") != "gpt2":
            raise OllamaError("Unsupported model family or byte-level tokenizer metadata")
        capacity = info.get("qwen3.context_length")
        capabilities = show.get("capabilities")
        if type(capacity) is not int or capacity < 8192 or not isinstance(capabilities, list) or any(not isinstance(c, str) for c in capabilities) or not {"completion", "thinking"}.issubset(capabilities):
            raise OllamaError("Unsupported context capacity or thinking controls")
        if not isinstance(template, str) or any(token not in template for token in ("<|im_start|>", "<|im_end|>", "<think>", "</think>")):
            raise OllamaError("Installed template does not establish raw Qwen envelope compatibility")
        version = self._request("GET", "/api/version").get("version")
        if not isinstance(version, str) or not version:
            raise OllamaError("Missing runtime version")
        return {"model": MODEL, "digest": digest, "templateSha256": hashlib.sha256(template.encode()).hexdigest(), "runtimeVersion": version, "details": details, "modelInfo": info, "capabilities": show["capabilities"], "template": template}

    def generate(self, prompt, digest, *, on_raw=None, on_start=None):
        validate_prompt_budget(prompt)
        before = self.preflight(digest)
        body = {"model": MODEL, "prompt": prompt, "raw": True, "think": False, "stream": False, "keep_alive": "30s", "options": dict(OPTIONS), "format": ANSWER_SCHEMA}
        if on_start:
            on_start(body)
        value = self._request("POST", "/api/generate", body, on_raw)
        raw = value.get("response")
        runtime = runtime_fields(value)
        error = None
        if not isinstance(raw, str):
            error = "Missing model response text"
        elif value.get("model") != MODEL or value.get("done") is not True or value.get("done_reason") != "stop" or value.get("thinking"):
            error = "Unsupported model, thinking output, or termination (including length stop)"
        elif runtime["inputTokens"] is not None and runtime["inputTokens"] + (runtime["outputTokens"] or 256) > 8192:
            error = "Runtime token counts exceed the context contract"
        elif runtime["outputTokens"] is not None and runtime["outputTokens"] > 256:
            error = "Runtime exceeded the output token cap"
        try:
            after = self.preflight(digest)
            if after["templateSha256"] != before["templateSha256"]:
                error = "Installed template changed during request"
        except OllamaError as failure:
            error = str(failure)
        if error:
            raise OllamaError(error, raw_response=raw, runtime=runtime)
        return {"rawResponse": raw, "runtime": runtime, "model": before}
