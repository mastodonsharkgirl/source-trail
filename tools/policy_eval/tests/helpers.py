"""Explicitly synthetic fixtures: never evaluation evidence."""
import copy
import json

DIGEST = "a" * 64
INPUT = {"query": "What is the fictional rule?", "principal": {"tenant": "cedar", "role": "employee"}, "asOf": "2026-10-13"}
PASSAGE = {"id": "synthetic-current-p1", "sourceId": "synthetic-current", "title": "Synthetic fixture", "version": "1", "text": "Use the synthetic blue form.", "start": 0, "end": 28, "documentSha256": "b" * 64, "tenant": "cedar", "allowedRoles": ["employee"], "policyKey": "form", "authority": "owner", "status": "current", "effectiveOn": "2026-01-01", "expiresOn": None, "supersedes": []}
ANSWER = {"decision": "answer", "answer": "Use the synthetic blue form.", "reasonCode": "supported", "citations": [{"passageId": PASSAGE["id"], "quote": PASSAGE["text"]}]}


def prepared():
    selections = []
    for method in ("lexical", "semantic", "full-context"):
        semantic = method == "semantic"
        selections.append({"method": method, "ranked": [] if method == "full-context" else [{"id": PASSAGE["id"], "score": .8}], "supplied": [copy.deepcopy(PASSAGE)], "excluded": [], "gate": "pass", "gateReason": None, "embeddingCacheHit": False if semantic else None, "timings": {"selectionMs": 5, "eligibilityMs": 1, "rankingMs": 1, "embeddingMs": 3 if semantic else None, "corpusEmbeddingMs": 2 if semantic else None, "queryEmbeddingMs": 1 if semantic else None}, "queryTokenCount": 8 if semantic else None, "passageTokenCounts": {PASSAGE["id"]: 8} if semantic else None})
    return {"caseId": "synthetic-case", "input": copy.deepcopy(INPUT), "selections": selections}


class SyntheticTransport:
    def __init__(self):
        self.requests = []
        self.digest = DIGEST
        self.show = {"details": {"family": "qwen3", "parameter_size": "synthetic"}, "capabilities": ["completion", "thinking"], "template": "<|im_start|>system <|im_end|> <|im_start|>assistant <think></think>", "model_info": {"general.architecture": "qwen3", "tokenizer.ggml.model": "gpt2", "qwen3.context_length": 40960}}
        self.generated = {"model": "qwen3:1.7b", "response": json.dumps(ANSWER), "done": True, "done_reason": "stop", "load_duration": 1000000, "prompt_eval_duration": 2000000, "eval_duration": 3000000, "total_duration": 7000000, "prompt_eval_count": 40, "eval_count": 20}
        self.failure = None
        self.raw = None
        self.status = 200

    def __call__(self, method, path, body):
        self.requests.append((method, path, copy.deepcopy(body)))
        if path == "/api/tags":
            result = {"models": [{"name": "qwen3:1.7b", "digest": self.digest}]}
        elif path == "/api/show":
            result = self.show
        elif path == "/api/version":
            result = {"version": "synthetic-test-only"}
        elif path == "/api/generate":
            if self.failure:
                raise self.failure
            return self.status, self.raw if self.raw is not None else json.dumps(self.generated).encode()
        else:
            raise AssertionError("Unexpected endpoint")
        return 200, json.dumps(result).encode()
