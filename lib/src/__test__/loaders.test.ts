import { describe, it, expect } from "vitest";
import { Document } from "@langchain/core/documents";
import { loadResources } from "../loaders";
import type { Resource } from "../loaders";

describe("loadResources", () => {
  it("loads plain text resources into documents", async () => {
    const resource: Resource[] = [
      { url: "foo.txt", text: "Hello world" },
    ];

    const docs = await loadResources({ resource });

    expect(docs).toHaveLength(1);
    expect(docs[0]).toHaveLength(1);
    expect(docs[0][0].pageContent).toContain("Hello world");
    expect(docs[0][0].metadata.source).toBe("foo.txt");
  });

  it("uses a custom loader registered by file suffix", async () => {
    const docs = await loadResources({
      resource: [{ url: "notes.md" }],
      loader: {
        ".md": async (resource) => [
          new Document({
            pageContent: "custom markdown content",
            metadata: { source: resource.url },
          }),
        ],
      },
    });

    expect(docs).toHaveLength(1);
    expect(docs[0][0].pageContent).toContain("custom markdown content");
    expect(docs[0][0].metadata.source).toBe("notes.md");
  });

  it("loads multiple resources independently", async () => {
    const resource: Resource[] = [
      { url: "a.txt", text: "content A" },
      { url: "b.txt", text: "content B" },
    ];

    const docs = await loadResources({ resource });

    expect(docs).toHaveLength(2);
    expect(docs.flat().map((d) => d.metadata.source)).toEqual([
      "a.txt",
      "b.txt",
    ]);
  });
});