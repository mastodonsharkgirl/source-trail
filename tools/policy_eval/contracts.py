"""Strict JSON boundaries; mechanical validity never implies source support."""
import datetime
import json
import math
import re

METHODS = ("lexical", "semantic", "full-context")
REASONS = ("supported", "missing_evidence", "conflicting_evidence", "unsafe_request")
IDENTIFIER = re.compile(r"[a-z0-9][a-z0-9-]{0,79}\Z")
HASH = re.compile(r"[a-f0-9]{64}\Z")
ANSWER_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["decision", "answer", "reasonCode", "citations"], "properties": {
    "decision": {"type": "string", "enum": ["answer", "abstain"]},
    "answer": {"type": "string", "minLength": 1},
    "reasonCode": {"type": "string", "enum": list(REASONS)},
    "citations": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["passageId", "quote"], "properties": {"passageId": {"type": "string"}, "quote": {"type": "string", "minLength": 1}}}},
}}


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result

    def invalid(_):
        raise ValueError("Non-finite JSON number")

    return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid)


def exact_keys(value, keys, label):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(f"{label}: unexpected or missing fields")


def nonempty(value, label):
    if not isinstance(value, str) or not value.strip() or "\x00" in value:
        raise ValueError(f"{label}: expected nonempty text")


def number(value, label, nullable=False, integer=False):
    if nullable and value is None:
        return
    if type(value) not in (int, float) or not math.isfinite(value) or value < 0 or (integer and type(value) is not int):
        raise ValueError(f"{label}: invalid nonnegative number")


def validate_input(value):
    exact_keys(value, ("query", "principal", "asOf"), "input")
    nonempty(value["query"], "query")
    if len(value["query"].encode("utf-16-le")) // 2 > 800:
        raise ValueError("query exceeds 800 UTF-16 units")
    exact_keys(value["principal"], ("tenant", "role"), "principal")
    if value["principal"]["tenant"] not in ("cedar", "harbour") or value["principal"]["role"] not in ("employee", "manager", "security"):
        raise ValueError("Unknown principal")
    if not isinstance(value["asOf"], str) or datetime.date.fromisoformat(value["asOf"]).isoformat() != value["asOf"]:
        raise ValueError("Invalid asOf date")
    return value


def validate_prepared_case(value):
    exact_keys(value, ("caseId", "input", "selections"), "prepared case")
    if not isinstance(value["caseId"], str) or not IDENTIFIER.fullmatch(value["caseId"]):
        raise ValueError("Invalid case ID")
    validate_input(value["input"])
    selections = value["selections"]
    if not isinstance(selections, list) or len(selections) != 3 or {s.get("method") for s in selections if isinstance(s, dict)} != set(METHODS):
        raise ValueError("Expected one selection per method")
    for selection in selections:
        exact_keys(selection, ("method", "ranked", "supplied", "excluded", "gate", "gateReason", "embeddingCacheHit", "timings", "queryTokenCount", "passageTokenCounts"), "selection")
        if selection["gate"] not in ("pass", "abstain"):
            raise ValueError("Invalid gate")
        if selection["gate"] == "abstain":
            nonempty(selection["gateReason"], "gate reason")
            if selection["supplied"]:
                raise ValueError("Gate abstention must not supply evidence")
        elif selection["gateReason"] is not None or not selection["supplied"]:
            raise ValueError("Pass requires evidence and no gate reason")
        for field in ("ranked", "supplied", "excluded"):
            if not isinstance(selection[field], list) or len(selection[field]) > 24:
                raise ValueError("Invalid selection array")
            ids = [item.get("id") for item in selection[field] if isinstance(item, dict)]
            if len(ids) != len(selection[field]) or any(not isinstance(i, str) or not i for i in ids) or len(ids) != len(set(ids)):
                raise ValueError("Invalid or duplicate passage IDs")
        if len(selection["ranked"]) > 3 or (selection["method"] == "full-context" and selection["ranked"]):
            raise ValueError("Invalid ranked list")
        for ranked in selection["ranked"]:
            exact_keys(ranked, ("id", "score"), "rank")
            if type(ranked["score"]) not in (int, float) or not math.isfinite(ranked["score"]):
                raise ValueError("Invalid score")
        for excluded in selection["excluded"]:
            exact_keys(excluded, ("id", "reason"), "exclusion")
            nonempty(excluded["reason"], "exclusion reason")
        for passage in selection["supplied"]:
            exact_keys(passage, ("id", "sourceId", "title", "version", "text", "start", "end", "documentSha256", "tenant", "allowedRoles", "policyKey", "authority", "status", "effectiveOn", "expiresOn", "supersedes"), "passage")
            for field in ("sourceId", "title", "version", "text", "policyKey", "authority"):
                nonempty(passage[field], field)
            if not isinstance(passage["documentSha256"], str) or not HASH.fullmatch(passage["documentSha256"]):
                raise ValueError("Invalid document hash")
            for field in ("start", "end"):
                number(passage[field], field, integer=True)
            if passage["end"] - passage["start"] != len(passage["text"].encode("utf-16-le")) // 2:
                raise ValueError("Invalid passage span length")
            principal = value["input"]["principal"]
            if passage["tenant"] != principal["tenant"] or not isinstance(passage["allowedRoles"], list) or principal["role"] not in passage["allowedRoles"] or passage["status"] != "current":
                raise ValueError("Ineligible supplied passage")
            if passage["effectiveOn"] > value["input"]["asOf"] or (passage["expiresOn"] is not None and passage["expiresOn"] < value["input"]["asOf"]):
                raise ValueError("Out-of-date supplied passage")
        if set(p["sourceId"] for p in selection["supplied"]) & set(p["id"] for p in selection["excluded"]):
            raise ValueError("Supplied evidence is excluded")
        times = selection["timings"]
        exact_keys(times, ("selectionMs", "eligibilityMs", "rankingMs", "embeddingMs", "corpusEmbeddingMs", "queryEmbeddingMs"), "timings")
        for name, duration in times.items():
            number(duration, name, nullable=name in ("embeddingMs", "corpusEmbeddingMs", "queryEmbeddingMs"))
        cache = selection["embeddingCacheHit"]
        if cache is not None and type(cache) is not bool:
            raise ValueError("Invalid cache observation")
        number(selection["queryTokenCount"], "query tokens", nullable=True, integer=True)
        token_counts = selection["passageTokenCounts"]
        if cache is None:
            if any(times[k] is not None for k in ("embeddingMs", "corpusEmbeddingMs", "queryEmbeddingMs")) or selection["queryTokenCount"] is not None or token_counts is not None:
                raise ValueError("Skipped embeddings require null measurements")
        else:
            if selection["method"] != "semantic" or times["queryEmbeddingMs"] is None or times["embeddingMs"] is None or selection["queryTokenCount"] is None or not isinstance(token_counts, dict):
                raise ValueError("Missing embedding measurements")
            if (cache and times["corpusEmbeddingMs"] is not None) or (not cache and times["corpusEmbeddingMs"] is None):
                raise ValueError("Cache observation contradicts corpus timing")
            if not math.isclose(times["embeddingMs"], (times["corpusEmbeddingMs"] or 0) + times["queryEmbeddingMs"]):
                raise ValueError("Embedding total disagrees with component times")
            for count in token_counts.values():
                number(count, "passage tokens", integer=True)
    return value


def validate_model_answer(raw, supplied):
    try:
        answer = strict_json(raw)
        exact_keys(answer, ("decision", "answer", "reasonCode", "citations"), "answer")
        if answer["decision"] not in ("answer", "abstain") or answer["reasonCode"] not in REASONS:
            raise ValueError("Unknown answer enum")
        if (answer["decision"] == "answer") != (answer["reasonCode"] == "supported"):
            raise ValueError("Decision and reason disagree")
        nonempty(answer["answer"], "answer text")
        citations = answer["citations"]
        if not isinstance(citations, list) or (answer["decision"] == "answer" and not citations):
            raise ValueError("Answers require citations")
        sources = {p["id"]: p["text"] for p in supplied}
        for citation in citations:
            exact_keys(citation, ("passageId", "quote"), "citation")
            nonempty(citation["passageId"], "passage ID")
            nonempty(citation["quote"], "quote")
            if citation["passageId"] not in sources or citation["quote"] not in sources[citation["passageId"]]:
                raise ValueError("Citation is not an exact supplied-source quote")
        return answer, []
    except (ValueError, TypeError, UnicodeError) as error:
        return None, [str(error)]
