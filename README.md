# langchain-rag-chat

> See Document: [English](https://github.com/yzby666/langchain-rag-chat) | [中文](https://github.com/yzby666/langchain-rag-chat/blob/main/README.zh-CN.md)

A TypeScript Retrieval-Augmented Generation (RAG) chat library built on the LangChain ecosystem. It combines document loading, vector retrieval, query expansion, category-based retrieval, and answer generation into a single `RAGChat` class.

## Features

- Document loading from web pages, PDFs, or plain text, with automatic chunking
- Vector storage with pluggable implementations (in-memory by default)
- Query expansion (Multi-Query) to improve retrieval recall
- Optional question classification with metadata-filtered retrieval
- Deduplication and compression of retrieved documents
- Streaming and non-streaming answer generation
- Lifecycle callbacks (`onStep`) for observability
- Fully typed configuration via `RAGOptions`

## Install

```bash
npm install langchain-rag-chat @langchain/classic @langchain/core @langchain/openai langchain
```

The package ships both ESM and CommonJS builds.

## Quick Start

```ts
import { RAGChat } from "langchain-rag-chat";

const rag = new RAGChat({
  chatModel: {
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
  },
  embeddingModelOptions: {
    model: "text-embedding-3-small",
    apiKey: process.env.OPENAI_API_KEY,
  },
  category: ["biology", "physics"] as const,
  enhancePrompt: 3,
});

// Load and index documents. Each resource is tagged with a category type.
await rag.load({
  resource: [
    { url: "https://example.com/biology.html", type: "biology" },
    { url: "https://example.com/physics.pdf", type: "physics" },
  ],
});

// Ask a question and get a final answer (non-streaming).
const answer = await rag.invoke({ question: "What is photosynthesis?" });
console.log(answer);

// Or stream the answer.
for await (const chunk of rag.stream("What is photosynthesis?")) {
  process.stdout.write(chunk);
}
```

## Configuration

All options are passed to the `RAGChat` constructor through the `RAGOptions` interface.

```ts
export interface RAGOptions<Q extends string> {
  chatModel: ChatOpenAIFields;
  vectorStore?: VectorStoreFactory;
  embeddings?: Embeddings;
  embeddingModelOptions?: EmbeddingModelOptions;
  enhancePrompt?: number;
  category?: Q[];
  enableClassification?: boolean;
  questionCategory?: [Q, string][];
  onStep?: (step: RAGStep, payload?: any) => void;
  preRetrieve?: RunnableLike;
  postRetrieve?: RunnableLike;
  loader?: CustomLoader<Q>;
}
```

### Option Reference

| Option                  | Type                       | Required | Default             | Description                                                                                                                          |
| ----------------------- | -------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `chatModel`             | `ChatOpenAIFields`         | ❌       | —                   | Chat model configuration (e.g. `{ model: "gpt-4o-mini", apiKey }`). Used for classification, query expansion, and answer generation. |
| `model`             | `BaseChatModel`         | ❌       | —                   | Instantiated custom chat model.  Takes precedence over `chatModel` when provided and is used for question classification, query expansion, answer generation, and answer streaming. |
| `vectorStore`           | `VectorStoreFactory`       | ❌       | `MemoryVectorStore` | Factory `(embeddings) => VectorStore` for a custom vector store implementation.                                                      |
| `embeddings`            | `Embeddings`               | ❌       | —                   | A ready-made embedding instance. Takes priority over `embeddingModelOptions` when both are provided.                                 |
| `embeddingModelOptions` | `EmbeddingModelOptions`    | ❌       | —                   | Configuration to create the embedding model when `embeddings` is not supplied.                                                       |
| `enhancePrompt`         | `number`                   | ❌       | `3`                 | Number of expanded queries generated from the original question (Multi-Query). Values `< 1` disable expansion.                       |
| `category`              | `Q[]`                      | ❌       | `[]`                | Allowed question categories used for classification. If empty, `load()` infers them from the loaded resource types.                  |
| `enableClassification`  | `boolean`                  | ❌       | `true`              | Whether to classify each question before retrieval. When disabled, documents are retrieved without category filtering.               |
| `questionCategory`      | `[Q, string][]`            | ❌       | `[]`                | Pairs of `[category, description]` that describe each category for the classification prompt.                                        |
| `onStep`                | `(step, payload?) => void` | ❌       | —                   | Lifecycle callback fired at each pipeline stage with the current payload (see `RAGStep`).                                            |
| `preRetrieve`           | `RunnableLike`             | ❌       | —                   | A runnable applied **before** retrieval, e.g. to rewrite queries or inject context.                                                  |
| `postRetrieve`          | `RunnableLike`             | ❌       | —                   | A runnable applied **after** retrieval/compression, e.g. to re-rank or transform documents.                                          |
| `loader`                | `CustomLoader<Q>`          | ❌       | —                   | Custom document loaders keyed by file suffix (e.g. `".txt"`), overriding the built-in loaders.                                       |

> ⚠️ Embedding: At least one of `embeddings` and `embeddingModelOptions` must be provided, otherwise the constructor throws. When both are provided, `embeddings` takes priority.
> ⚠️ ChatModel: At least one of `model` and `chatModel` must be provided, otherwise the constructor throws. When both are provided, `model` takes priority.

### `RAGStep`

The `onStep` callback receives one of the following stage names:

```ts
export type RAGStep =
  | "classification" // question classification
  | "vectorStore" // documents indexed into the vector store (after load)
  | "retrieve" // retrieval complete
  | "compress" // deduplication/compression complete
  | "answer"; // answer generation started
```

## Related Types

### `EmbeddingModelOptions`

```ts
export interface EmbeddingModelOptions extends Partial<OpenAIEmbeddingsParams> {
  verbose?: boolean;
  openAIApiKey?: OpenAIApiKey; // alias for apiKey
  apiKey?: OpenAIApiKey;
  configuration?: ClientOptions;
}
```

### `LoadOptions`

Configuration for loading and indexing documents via `RAGChat.load()`.

```ts
export interface LoadOptions<Q extends string> {
  resource: Resource<Q>[];
  concurrencyCount?: number; // default 3
  splitterOptions?: RecursiveCharacterTextSplitterParams;
  loader?: CustomLoader<Q> | null;
}
```

### `Resource`

Describes a single source document.

```ts
export interface Resource<Q extends string = string> {
  url: string; // http(s) URL for web pages or PDFs; other suffixes are plain text (non-HTTP PDFs need a custom loader)
  type?: Q; // category tag written to document metadata (used for classification filtering)
  selector?: string; // CSS selector for web pages (default "body")
  text?: string; // plain text content (used when the url has no known loader)
}
```

### `CustomLoader`

Map of suffix → loader function, where the key is the file suffix (e.g. `".md"`).

```ts
export interface CustomLoader<Q extends string = string> {
  [suffix: string]: (resource: Resource<Q>) => Promise<Document<any>[]>;
}
```

### `VectorStoreFactory` / `InputQuestion`

```ts
export type VectorStoreFactory = (embeddings: Embeddings) => VectorStore;

export interface InputQuestion {
  question: string;
  k?: number; // number of documents to retrieve (default 3)
}
```

## API

### `constructor(options: RAGOptions<Q>)`

Creates a `RAGChat` instance and prepares the retrieval and answer chains.

### `load(loadOptions: LoadOptions<Q>)`

Loads resources, writes each resource's `type` into the documents' `metadata._type`, splits them into chunks, and adds them to the vector store. If `category` is empty, it is inferred from the loaded resource types.

### `retrieveDocuments(question: string[], kOrFields?)`

Searches the vector store for the given question(s) and returns the matched `Document[]`.

### `invoke(input: string | InputQuestion, options?)`

Runs the full RAG pipeline and returns the generated answer string.

### `stream(input: string | InputQuestion, options?)`

Runs the RAG pipeline and streams the generated answer chunks (async generator).

### `classification(question, category?, questionCategory?)`

Classifies a question into one of the configured categories (or `"other"`).

### `expandQuestion(question, queryCount?)`

Generates `queryCount` expanded queries from the original question (Multi-Query).

### `deduplicateAndCompress(docs)`

Removes duplicate documents and truncates long content (to 500 characters).

## Pipeline

```
question
  → classification (optional)
  → query expansion
  → preRetrieve
  → retrieve (category-filtered)
  → deduplicate & compress
  → postRetrieve
  → answer generation
```

## License

MIT
