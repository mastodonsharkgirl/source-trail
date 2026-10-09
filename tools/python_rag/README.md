# Python / LangChain companion

This separately launched CLI is real Python. The public browser app does not execute LangChain. No server or public backend is created.

## Run on Windows (Python 3.14 tested)

```powershell
py -3.14 -m venv tools/python_rag/.venv
tools/python_rag/.venv/Scripts/python -m pip install -r tools/python_rag/requirements.lock
tools/python_rag/.venv/Scripts/python tools/python_rag/companion.py --query "rabbit bridge sunrise" --output output/companion.json
tools/python_rag/.venv/Scripts/python -m unittest discover -s tools/python_rag -v
```

`--pack` accepts an exported Meadow Atlas JSON pack, including the browser run export (which contains its immutable source snapshots). Inputs and source text are included only in your deliberate local JSON export. The code disables LangSmith tracing and uses fixed loopback Ollama URLs; it does not automatically download models.

The default no-model path uses real LangChain Document, RecursiveCharacterTextSplitter, a custom VocabularyEmbeddings implementation, InMemoryVectorStore and its retriever. These are deterministic lexical vectors, **not learned semantic embeddings**. They make the complete framework path usable without a large runtime. Unknown vocabulary returns no passage rather than passing a zero vector into cosine similarity.

For a separately installed local model, add `--embedding-model EXACT_INSTALLED_EMBEDDING_TAG` to use actual OllamaEmbeddings, and/or `--generator EXACT_INSTALLED_CHAT_TAG` to use ChatPromptTemplate → ChatOllama → StrOutputParser. These adapters are implemented, but require separate real-model verification; a no-model test does not establish their output quality. No model was silently installed for them. Generation is capped at 256 tokens, and companion inputs/chunks are bounded; this companion does not claim the browser generator's exact-token budget implementation.

## One example, twice

Plain Python: `plain_retrieve` tokenizes the query and source texts, counts shared words, sorts and returns three passages.

LangChain: `framework_retrieve` wraps the same IDs/versions in Document objects, splits with source offsets, embeds local vocabulary vectors, stores them in memory and invokes the actual retriever. Both paths preserve exact source text. LangChain assembles the pipeline; it does not make its answers true.

Archived sources are excluded before indexing. Every returned chunk is checked against its original text span. The JSON contains both paths for comparison and retains generation as null unless explicitly requested. These tiny authored sources are fiction, never company or student records.

Official references checked 2026-10-09: https://docs.langchain.com/oss/python/integrations/vectorstores/in_memory, https://docs.langchain.com/oss/python/integrations/embeddings/ollama, https://docs.langchain.com/oss/python/integrations/chat/ollama.
