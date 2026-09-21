import { OpenAIEmbeddings } from "@langchain/openai";

import type {
  OpenAIEmbeddingsParams,
  OpenAIApiKey,
  ClientOptions,
} from "@langchain/openai";

export interface EmbeddingModelOptions extends Partial<OpenAIEmbeddingsParams> {
  verbose?: boolean;
  /**
   * The OpenAI API key to use.
   * Alias for `apiKey`.
   */
  openAIApiKey?: OpenAIApiKey;
  /** The OpenAI API key to use. */
  apiKey?: OpenAIApiKey;
  configuration?: ClientOptions;
}

/** Create an embedding model from the given configuration. */
export function createEmbeddingModel(options: EmbeddingModelOptions) {
  return new OpenAIEmbeddings(options);
}
