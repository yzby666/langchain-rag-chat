import { ChatOpenAI } from "@langchain/openai";

import type { ChatOpenAIFields } from "@langchain/openai";

/** Create a chat model from the given configuration. */
export function createChatModel(options: ChatOpenAIFields) {
  return new ChatOpenAI(options);
}
