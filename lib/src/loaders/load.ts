import { Document } from "@langchain/core/documents";

import { loadPDF } from "./pdfLoader";
import { loadWebPage } from "./webLoader";

import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";

import { concurrency } from "../utils";

import type { RecursiveCharacterTextSplitterParams } from "@langchain/classic/text_splitter";

/** Describes a single document source to load. */
export interface Resource<Q extends string = string> {
  /**
   * Source URL. `http(s)` web pages and `http(s)` `.pdf` files are fetched
   * over HTTP; other suffixes are treated as plain text and use this value as
   * the source metadata. Non-HTTP `.pdf` resources require a custom loader.
   */
  url: string;

  /**
   * CSS selector used to extract content from a web page.
   * @default "body"
   */
  selector?: string;

  /** Plain text content used when no built-in loader matches the url. */
  text?: string;

  /**
   * Optional category tag written to the documents' `metadata._type` and used
   * for classification-based filtering.
   */
  type?: Q;
}

/**
 * Custom document loaders keyed by file suffix (e.g. `".txt"`, `".md"`).
 * A loader is used when its key matches the suffix of the resource url.
 */
export interface CustomLoader<Q extends string = string> {
  [suffix: string]: (resource: Resource<Q>) => Promise<Document<any>[]>;
}

/** Options for loading and splitting resources via `loadResources`. */
export interface LoadOptions<Q extends string> {
  /** Document sources to load. */
  resource: Resource<Q>[];

  /**
   * Maximum number of concurrent loads.
   * @default 3
   */
  concurrencyCount?: number;

  /** Options passed to the recursive character text splitter. */
  splitterOptions?: RecursiveCharacterTextSplitterParams;

  /** Custom loaders that override the built-in loaders by suffix. */
  loader?: CustomLoader<Q> | null;
}

/** Extract the file suffix from a path or URL, including the leading dot. */
function getSuffix(str: string) {
  if (!str.length) {
    return "";
  }
  return str.substring(str.lastIndexOf("."));
}

/** Select a built-in loader based on the resource url. */
function resolveLoader(resource: Resource): () => Promise<Document<any>[]> {
  const suffix = getSuffix(resource.url);
  if (suffix === ".pdf") {
    return () => loadPDF({ url: resource.url });
  }
  if (
    resource.url.startsWith("http://") ||
    resource.url.startsWith("https://")
  ) {
    // web page
    return () =>
      loadWebPage({ url: resource.url, selector: resource.selector });
  }
  return () =>
    Promise.resolve([
      new Document({
        pageContent: resource.text ?? "",
        metadata: {
          source: resource?.url,
        },
      }),
    ]);
}

/**
 * Load and split the given resources into documents.
 *
 * Each resource's optional `type` is written to the documents' `metadata._type`
 * so they can be filtered by category during retrieval.
 *
 * @param options - Load options including resources and splitter settings.
 * @returns Chunked documents, one array per resource.
 */
export async function loadResources<Q extends string>(options: LoadOptions<Q>) {
  const { resource, splitterOptions, loader, concurrencyCount = 3 } = options;
  const tasks = await concurrency(
    resource.map((v) => {
      const suffix = getSuffix(v.url);
      const loadFn = loader?.[suffix]
        ? () => loader[suffix](v)
        : resolveLoader(v);
      return async () => {
        const docs = await loadFn();
        if (v.type) {
          docs.forEach((doc) => {
            doc.metadata._type = v.type;
          });
        }
        return docs;
      };
    }),
    concurrencyCount,
  );

  const splitter = new RecursiveCharacterTextSplitter({
    ...splitterOptions,
    chunkSize: splitterOptions?.chunkSize ?? 1000,
    chunkOverlap: splitterOptions?.chunkOverlap ?? 200,
  });

  return await Promise.all(tasks.map((v) => splitter.splitDocuments(v)));
}
