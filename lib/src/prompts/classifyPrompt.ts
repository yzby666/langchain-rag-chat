import { ChatPromptTemplate } from "@langchain/core/prompts";

export interface Classify {
  category: string;
  question: string;
  content: string;
}

/** Prompt template for classifying questions. */
export const classifyPrompt =
  ChatPromptTemplate.fromTemplate(`Classify user questions into the following categories: {category}.
{content}
Special note: Only output the classification names, do not output explanations.
User question: {question}`);
