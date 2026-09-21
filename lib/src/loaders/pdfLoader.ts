import { Document } from "@langchain/core/documents";
import { PDFParse } from "pdf-parse";
import type { LoadParameters } from "pdf-parse";

export interface PDFLoader extends LoadParameters {
  /**
   * http(s) url of the PDF file
   */
  url: string;
}

export async function loadPDF(options: PDFLoader) {
  const { url, ...opt } = options;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `loadPDF only supports http(s) URLs. For "${url}" provide a custom PDF loader instead.`,
    );
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch PDF: ${response.status} ${response.statusText}`,
    );
  }
  const data = new Uint8Array(await response.arrayBuffer());

  const parser = new PDFParse({
    data,
    ...opt,
  });
  try {
    const { pages } = await parser.getText();
    return pages.map(
      (page) =>
        new Document({
          pageContent: page.text,
          metadata: { source: url, page: page.num - 1 },
        }),
    );
  } finally {
    await parser.destroy();
  }
}
