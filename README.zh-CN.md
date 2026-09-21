# langchain-rag-chat

一个基于 LangChain 生态的 TypeScript RAG（检索增强生成）聊天库。它将文档加载、向量检索、问题扩展、分类检索和答案生成整合到一个 `RAGChat` 类中。

## 特性

- 支持从网页、PDF 或纯文本加载文档，并自动分块
- 可插拔的向量存储（默认为内存存储）
- 问题扩展（Multi-Query）以提升检索召回率
- 可选的问题分类 + 按元数据过滤的检索
- 检索结果的去重与压缩
- 支持流式和非流式答案生成
- 通过 `onStep` 提供生命周期回调，便于观察运行过程
- 通过 `RAGOptions` 提供完整的类型化配置

## 安装

```bash
npm install langchain-rag-chat @langchain/classic @langchain/core @langchain/openai langchain
```

本包同时提供 ESM 与 CommonJS 两种构建产物，可兼容 `import` 与 `require`。

## 快速开始

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

// 加载并索引文档。每个资源会打上对应的分类标签。
await rag.load({
  resource: [
    { url: "https://example.com/biology.html", type: "biology" },
    { url: "https://example.com/physics.pdf", type: "physics" },
  ],
});

// 提问并获取最终答案（非流式）。
const answer = await rag.invoke({ question: "什么是光合作用？" });
console.log(answer);

// 或流式输出答案。
for await (const chunk of rag.stream("什么是光合作用？")) {
  process.stdout.write(chunk);
}
```

## 配置项

所有配置项都通过 `RAGOptions` 接口传入 `RAGChat` 构造函数。

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

### 配置项说明

| 配置项                  | 类型                       | 必填 | 默认值              | 作用                                                                                      |
| ----------------------- | -------------------------- | ---- | ------------------- | ----------------------------------------------------------------------------------------- |
| `chatModel`             | `ChatOpenAIFields`         | ✅   | —                   | 聊天模型配置（如 `{ model: "gpt-4o-mini", apiKey }`），用于问题分类、问题扩展和答案生成。 |
| `vectorStore`           | `VectorStoreFactory`       | ❌   | `MemoryVectorStore` | 自定义向量存储工厂 `(embeddings) => VectorStore`。                                        |
| `embeddings`            | `Embeddings`               | ❌   | —                   | 已创建好的 embedding 实例。与 `embeddingModelOptions` 同时提供时，优先使用 `embeddings`。                                               |
| `embeddingModelOptions` | `EmbeddingModelOptions`    | ❌   | —                   | 在未提供 `embeddings` 时，用于创建 embedding 模型的配置。                                 |
| `enhancePrompt`         | `number`                   | ❌   | `3`                 | 由原始问题生成的扩展查询数量（Multi-Query）。小于 1 时不进行扩展。                        |
| `category`              | `Q[]`                      | ❌   | `[]`                | 允许的问题分类数组，用于问题分类。为空时，`load()` 会从加载的资源类型中推断。             |
| `enableClassification`  | `boolean`                  | ❌   | `true`              | 是否在检索前对问题进行分类。关闭后检索将不再按分类过滤。                                  |
| `questionCategory`      | `[Q, string][]`            | ❌   | `[]`                | `[分类, 描述]` 的配对数组，为分类提示词描述每个分类的含义。                               |
| `onStep`                | `(step, payload?) => void` | ❌   | —                   | 生命周期回调，在各阶段携带当前 payload 触发（见 `RAGStep`）。                                              |
| `preRetrieve`           | `RunnableLike`             | ❌   | —                   | 在**检索之前**应用的 runnable，例如重写查询或注入上下文。                                       |
| `postRetrieve`          | `RunnableLike`             | ❌   | —                   | 在**检索/压缩之后**应用的 runnable，例如重排或转换文档。                                  |
| `loader`                | `CustomLoader<Q>`              | ❌   | —                   | 按文件后缀（如 `.txt`）注册的自定义文档加载器，可覆盖内置加载器。                         |

> ⚠️ `embeddings` 与 `embeddingModelOptions` 至少需提供其一，否则构造函数会抛出异常。两者同时提供时优先使用 `embeddings`。

### `RAGStep`

`onStep` 回调会收到以下某个阶段名称：

```ts
export type RAGStep =
  | "classification" // 问题分类
  | "vectorStore" // 文档已写入向量存储（load 之后）
  | "retrieve" // 检索完成
  | "compress" // 去重/压缩完成
  | "answer"; // 开始生成答案
```

## 相关类型

### `EmbeddingModelOptions`

```ts
export interface EmbeddingModelOptions extends Partial<OpenAIEmbeddingsParams> {
  verbose?: boolean;
  openAIApiKey?: OpenAIApiKey; // apiKey 的别名
  apiKey?: OpenAIApiKey;
  configuration?: ClientOptions;
}
```

### `LoadOptions`

`RAGChat.load()` 加载与索引文档时使用的配置。

```ts
export interface LoadOptions<Q extends string> {
  resource: Resource<Q>[];
  concurrencyCount?: number; // 默认 3
  splitterOptions?: RecursiveCharacterTextSplitterParams;
  loader?: CustomLoader<Q> | null;
}
```

### `Resource`

描述单个文档来源。

```ts
export interface Resource<Q extends string = string> {
  url: string; // 网页或 PDF 的 http(s) URL；其他后缀作为纯文本来源（非 http 的 PDF 需自定义 loader）
  type?: Q; // 写入文档元数据的分类标签（用于分类过滤）
  selector?: string; // 网页 CSS 选择器（默认 "body"）
  text?: string; // 纯文本内容（当 url 无对应加载器时使用）
}
```

### `CustomLoader`

后缀 → 加载函数 的映射，键为文件后缀（如 `.md`）。

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
  k?: number; // 检索返回的文档数量（默认 3）
}
```

## API

### `constructor(options: RAGOptions<Q>)`

创建 `RAGChat` 实例，并准备检索链与答案生成链。

### `load(loadOptions: LoadOptions<Q>)`

加载资源、将每个资源的 `type` 写入文档的 `metadata._type`、分块并写入向量存储。当 `category` 为空时，会从加载的资源类型中推断。

### `retrieveDocuments(question: string[], kOrFields?)`

在向量存储中检索给定问题，返回匹配的 `Document[]`。

### `invoke(input: string | InputQuestion, options?)`

执行完整 RAG 流程并返回生成的答案字符串。

### `stream(input: string | InputQuestion, options?)`

执行 RAG 流程并以异步生成器流式输出答案。

### `classification(question, category?, questionCategory?)`

将问题分类到某个已配置的分类（或 `"other"`）。

### `expandQuestion(question, queryCount?)`

从原始问题生成 `queryCount` 个扩展查询（Multi-Query）。

### `deduplicateAndCompress(docs)`

去除重复文档并对过长的内容进行截断（截断到 500 字符）。

## 执行流程

```
问题
  → 问题分类（可选）
  → 问题扩展
  → preRetrieve
  → 检索（按分类过滤）
  → 去重与压缩
  → postRetrieve
  → 答案生成
```

## 许可证

MIT
