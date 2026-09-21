import { ChatPromptTemplate } from "@langchain/core/prompts";

export interface Answer {
  question: string;
  context: string;
}

/** Prompt template for generating the final answer. */
export const answerPrompt =
  ChatPromptTemplate.fromTemplate(`Please answer the user's question based on the content of the following document. If there is insufficient information in the document, do your best to answer the user's question within your capabilities, and then clearly indicate whether the answer is based on the content of the document.
Document:
{context}
User question:
{question}`);
