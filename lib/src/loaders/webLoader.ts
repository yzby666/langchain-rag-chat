import { load } from "cheerio";

import { Document } from "@langchain/core/documents";

export interface WebURL {
  /**
   * web url
   */
  url: string;
  /**
   * css selector
   * @default "body"
   */
  selector?: string;
}

export async function loadWebPage(options: WebURL) {
  const { url, selector = "body" } = options;

  let content = "";
  const response = await fetch(url);
  if (!response.ok) {
    content = `[Error] URL load Error: ${url}`;
  } else {
    const text = await response.text();
    content = load(text)(selector).text();
  }
  const doc = new Document({
    pageContent: content,
    metadata: { source: url, selector },
  });

  return [doc];
}
