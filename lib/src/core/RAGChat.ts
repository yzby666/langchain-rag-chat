import { createEmbeddingModel, createChatModel } from "../models";
import { multiQueryPrompt, classifyPrompt, answerPrompt } from "../prompts";
import { loadResources } from "../loaders";

import { Document } from "@langchain/core/documents";
import { VectorStore } from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";

import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";

import type { EmbeddingModelOptions } from "../models";
import type { LoadOptions, CustomLoader } from "../loaders";
import type { VectorStoreRetrieverInput } from "@langchain/core/vectorstores";
import type { ChatOpenAIFields } from "@langchain/openai";
import type { RunnableConfig, RunnableLike } from "@langchain/core/runnables";

/**
 * Factory that builds a vector store from an embedding instance.
 * Use it to plug in a custom vector store implementation.
 */
export type VectorStoreFactory = (embeddings: Embeddings) => VectorStore;

/**
 * Named stages of the RAG pipeline.
 *
 * Each stage is reported to `RAGOptions.onStep` as the pipeline progresses.
 */
export type RAGStep =
  | "classification"
  | "vectorStore"
  | "retrieve"
  | "compress"
  | "answer";

export interface RAGOptions<Q extends string> {
  /**
   * Chat model configuration passed to `ChatOpenAI`.
   * Used for question classification, query expansion, and answer generation.
   */
  chatModel: ChatOpenAIFields;

  /**
   * Custom vector store factory that receives the resolved embedding model
   * and returns a vector store implementation.
   * @default MemoryVectorStore
   */
  vectorStore?: VectorStoreFactory;

  /**
   * A ready-made embedding instance used to vectorize documents and queries.
   * Takes priority over `embeddingModelOptions` when both are provided.
   */
  embeddings?: Embeddings;

  /**
   * Configuration used to create the embedding model when `embeddings` is
   * not provided. At least one of `embeddings` and `embeddingModelOptions`
   * must be provided, otherwise the constructor throws.
   */
  embeddingModelOptions?: EmbeddingModelOptions;

  /**
   * Number of expanded query variants to generate per question (Multi-Query).
   * A value below 1 disables query expansion.
   * @default 3
   */
  enhancePrompt?: number;

  /**
   * Allowed question categories used by the classifier.
   * When empty, `load()` infers them from the loaded resource types.
   */
  category?: Q[];

  /**
   * Whether to classify each question before retrieval. When disabled,
   * documents are retrieved without category filtering.
   * @default true
   */
  enableClassification?: boolean;

  /**
   * Pairs of `[category, description]` passed to the classifier prompt to
   * describe the meaning of each category.
   */
  questionCategory?: [Q, string][];

  /**
   * Lifecycle callback invoked at each pipeline stage with the current
   * payload. Useful for observability and debugging.
   */
  onStep?: (step: RAGStep, payload?: any) => void;

  /**
   * Runnable applied to the pipeline input before retrieval, for example to
   * rewrite queries or inject additional context.
   */
  preRetrieve?: RunnableLike;

  /**
   * Runnable applied after retrieval and compression, for example to re-rank
   * or transform the retrieved documents.
   */
  postRetrieve?: RunnableLike;

  /**
   * Custom document loaders keyed by file suffix (e.g. `".txt"`), overriding
   * the built-in loaders when the suffix matches.
   */
  loader?: CustomLoader<Q>;
}

export interface InputQuestion {
  /** The user question. */
  question: string;
  /** Number of documents to retrieve. @default 3 */
  k?: number;
}

/**
 * Retrieval-augmented chat pipeline built on LangChain.
 *
 * Orchestrates document loading, question classification, query expansion,
 * retrieval, compression, and answer generation into a single chain.
 */
export class RAGChat<Q extends string> {
  /** Underlying vector store used for retrieval. */
  vectorStore: VectorStore;
  /** Chat model used for classification, expansion, and answering. */
  chatModel: ReturnType<typeof createChatModel>;
  /** Embedding model used to vectorize documents and queries. */
  embeddings: Embeddings;
  /** Number of expanded query variants to generate per question. */
  enhancePrompt: number;
  /** Allowed question categories. */
  private category: Q[] = [];
  /** Category descriptions passed to the classifier. */
  private questionCategory: [Q, string][] = [];
  private onStep: RAGOptions<Q>["onStep"] | null = null;
  private chain: RunnableSequence;
  private retrievalChain: RunnableSequence;
  private loader: CustomLoader<Q> | null = null;
  /** Runnable applied before retrieval. */
  private preRetrieve: RunnableLike | null = null;
  /** Runnable applied after retrieval and compression. */
  private postRetrieve: RunnableLike | null = null;
  /** Toggle question classification. */
  enableClassification: boolean = true;

  constructor(options: RAGOptions<Q>) {
    const {
      chatModel,
      embeddings,
      embeddingModelOptions,
      enhancePrompt = 3,
      category = [],
      questionCategory = [],
      preRetrieve = null,
      postRetrieve = null,
      enableClassification = true,
      loader = null,
    } = options;

    const em = embeddings
      ? embeddings
      : embeddingModelOptions
        ? createEmbeddingModel(embeddingModelOptions)
        : null;
    if (!em) {
      throw new Error(
        "Either 'embeddings' or 'embeddingModelOptions' must be provided",
      );
    }
    this.enhancePrompt = enhancePrompt;
    this.category = category;
    this.embeddings = em;
    this.questionCategory = questionCategory;
    this.enableClassification = enableClassification;
    this.loader = loader;
    this.onStep = options.onStep;

    this.chatModel = createChatModel(chatModel);
    this.preRetrieve = preRetrieve;
    this.postRetrieve = postRetrieve;

    this.vectorStore = options.vectorStore
      ? options.vectorStore(em)
      : new MemoryVectorStore(em);

    this.retrievalChain = this.createRetrieveProcess();
    this.chain = this.createProcess();
  }

  /**
   * Load and index documents into the vector store.
   *
   * Each resource's `type` is written to its documents' `metadata._type` so
   * that retrieval can later filter by category. If `category` is not set, it
   * is inferred from the loaded resource types.
   *
   * @param loadOptions - Load options whose resources carry a `type` tag.
   */
  async load(loadOptions: LoadOptions<Q>) {
    const { resource, loader } = loadOptions;

    if (!resource.length) {
      return;
    }
    if (!this.category.length) {
      this.category = [
        ...new Set(resource.filter((v) => v.type).map((v) => v.type)),
      ] as Q[];
    }
    const documents = await loadResources({
      ...loadOptions,
      loader: loader ? loader : this.loader,
    });
    await Promise.all(
      documents.map((doc) => this.vectorStore.addDocuments(doc)),
    );

    this.onStep?.("vectorStore");
  }

  /**
   * Search the vector store for the given questions.
   *
   * @param question - Question strings to retrieve documents for.
   * @param kOrFields - Number of documents to return, or retriever options.
   * @returns Flattened matching documents.
   */
  async retrieveDocuments(
    question: string[],
    kOrFields?:
      | number
      | Partial<VectorStoreRetrieverInput<typeof this.vectorStore>>,
  ) {
    const retriever = this.vectorStore.asRetriever(kOrFields);

    const res = await Promise.all(question.map((q) => retriever.invoke(q)));

    const docs: Document[] = res.flat();

    return docs;
  }

  private createRetrieveProcess() {
    return RunnableSequence.from([
      RunnableLambda.from(async (question) =>
        typeof question === "string" ? { question } : question,
      ),
      RunnablePassthrough.assign({
        type: async (input) => {
          if (!this.enableClassification) {
            return undefined;
          }
          const type = await this.classification(input.question);
          this.onStep?.("classification", { ...input, type });
          return type;
        },
        expandedQuestion: async (input) => this.expandQuestion(input.question),
      }),
      this.preRetrieve
        ? this.preRetrieve
        : RunnableLambda.from(async (input) => input),
      RunnablePassthrough.assign({
        documents: async (input) => {
          const retrieveOptions = {
            k: input?.k ?? 3,
            ...(this.enableClassification &&
            input.type &&
            input.type !== "other"
              ? {
                  filter: (doc: Document) => doc.metadata?._type === input.type,
                }
              : {}),
          };
          const docs = await this.retrieveDocuments(
            input.expandedQuestion,
            retrieveOptions,
          );
          this.onStep?.("retrieve", { ...input, documents: docs });
          return docs;
        },
      }),
      RunnablePassthrough.assign({
        compressedDocuments: async (input) => {
          const compress = this.deduplicateAndCompress(input.documents);
          this.onStep?.("compress", {
            ...input,
            compressedDocuments: compress,
          });
          return compress;
        },
      }),
      this.postRetrieve
        ? this.postRetrieve
        : RunnableLambda.from(async (input) => input),
    ]);
  }

  private createProcess() {
    const chain = RunnableSequence.from([
      this.retrievalChain,
      RunnablePassthrough.assign({
        answer: async (input) => {
          const context = input.compressedDocuments
            .map((v: Document) => v.pageContent)
            .join("\n");
          const question = input.question;
          this.onStep?.("answer", input);
          return this.answer(context, question);
        },
      }),
      RunnableLambda.from(async (input) => input),
    ]);

    return chain;
  }

  /**
   * Classify a question into one of the configured categories, returning
   * `"other"` when no category matches.
   *
   * @param question - The question to classify.
   * @param category - Category list to classify against.
   * @param questionCategory - Category descriptions for the prompt.
   * @returns The matched category or `"other"`.
   */
  async classification(
    question: string,
    category: string[] = this.category,
    questionCategory: [Q, string][] = this.questionCategory,
  ): Promise<Q | "other"> {
    const result = await classifyPrompt
      .pipe(this.chatModel)
      .pipe(new StringOutputParser())
      .invoke({
        category: category.join(" / "),
        question,
        content:
          questionCategory?.map(
            ([type, str], i) => `${i + 1}: ${str} Should be obtained ${type}\n`,
          ) ?? "",
      });
    const type = result.trim();
    if (!category.includes(type)) {
      return "other";
    }

    return type as Q;
  }

  /**
   * Generate expanded query variants of a question (Multi-Query).
   *
   * @param question - The original question.
   * @param queryCount - Number of variants; values below 1 return the original.
   * @returns The expanded query strings.
   */
  async expandQuestion(
    question: string,
    queryCount: number = this.enhancePrompt,
  ): Promise<string[]> {
    if (queryCount < 1) {
      return [question];
    }
    const result = await multiQueryPrompt
      .pipe(this.chatModel)
      .pipe(new StringOutputParser())
      .invoke({
        question,
        separator: "\n",
        queryCount,
      });

    return result
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private async answer(context: string, question: string) {
    const result = await answerPrompt
      .pipe(this.chatModel)
      .pipe(new StringOutputParser())
      .invoke({
        question,
        context,
      });
    return result;
  }

  private async streamAnswer(
    context: string,
    question: string,
    options?: RunnableConfig,
  ) {
    return await answerPrompt
      .pipe(this.chatModel)
      .pipe(new StringOutputParser())
      .stream(
        {
          question,
          context,
        },
        options,
      );
  }

  /**
   * Deduplicate documents by their trimmed content and truncate long content
   * to keep the retrieval context concise.
   *
   * @param docs - Documents to deduplicate and compress.
   * @returns Deduplicated documents with truncated content.
   */
  deduplicateAndCompress(docs: Document[]): Document[] {
    const seenContent = new Set<string>();
    const uniqueDocs: Document[] = [];

    for (const doc of docs) {
      const trimmed = doc.pageContent.trim();
      if (!seenContent.has(trimmed)) {
        seenContent.add(trimmed);
        // Truncate long content to keep the retrieval context concise.
        const compressedContent = trimmed.slice(0, 500);
        uniqueDocs.push(
          new Document({
            pageContent: compressedContent,
            metadata: doc.metadata,
          }),
        );
      }
    }

    return uniqueDocs;
  }

  /**
   * Run the full RAG pipeline and return the generated answer.
   *
   * @param input - A question string or an `InputQuestion`.
   * @param options - Optional runnable configuration.
   * @returns The generated answer string.
   */
  async invoke(input: string | InputQuestion, options?: RunnableConfig) {
    const result = await this.chain.invoke(input, options);
    return result.answer as string;
  }

  /**
   * Run the RAG pipeline and stream the generated answer.
   *
   * @param input - A question string or an `InputQuestion`.
   * @param options - Optional runnable configuration.
   * @returns An async generator of answer chunks.
   */
  async *stream(input: string | InputQuestion, options?: RunnableConfig) {
    const result = await this.retrievalChain.invoke(input, options);

    const context = result.compressedDocuments
      .map((doc: Document) => doc.pageContent)
      .join("\n");

    this.onStep?.("answer", result);

    const answerStream = await this.streamAnswer(
      context,
      result.question,
      options,
    );

    for await (const chunk of answerStream) {
      yield chunk;
    }
  }
}
