import { describe, it, expect } from "vitest";
import { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { RAGChat } from "../core";

const fakeEmbeddings: Embeddings = {
  caller: new AsyncCaller({}),
  embedDocuments: async (docs: string[]) => docs.map(() => [0]),
  embedQuery: async () => [0],
};

function createRag() {
  return new RAGChat<string>({
    chatModel: { model: "gpt-4o-mini", apiKey: "test-key" },
    embeddings: fakeEmbeddings,
    enhancePrompt: 0,
  });
}

describe("RAGChat", () => {
  it("throws when neither embeddings nor embeddingModelOptions is provided", () => {
    expect(
      () =>
        new RAGChat<string>({
          chatModel: { model: "gpt-4o-mini", apiKey: "test-key" },
        }),
    ).toThrow();
  });

  it("deduplicates documents by trimmed content", () => {
    const rag = createRag();
    const docs = [
      new Document({ pageContent: "  hello world  ", metadata: {} }),
      new Document({ pageContent: "hello world", metadata: {} }),
      new Document({ pageContent: "another doc", metadata: {} }),
    ];

    const result = rag.deduplicateAndCompress(docs);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.pageContent)).toEqual([
      "hello world",
      "another doc",
    ]);
  });

  it("truncates long document content to 500 characters", () => {
    const rag = createRag();
    const longText = "a".repeat(1000);
    const docs = [new Document({ pageContent: longText, metadata: {} })];

    const result = rag.deduplicateAndCompress(docs);

    expect(result).toHaveLength(1);
    expect(result[0].pageContent).toHaveLength(500);
  });

  it("returns the original question when query count is below 1", async () => {
    const rag = createRag();

    const result = await rag.expandQuestion("hello world", 0);

    expect(result).toEqual(["hello world"]);
  });
});