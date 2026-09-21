import { ChatPromptTemplate } from "@langchain/core/prompts";

export interface MultiQuery {
  queryCount: number;
  separator: string;
  question: string;
}

/** Prompt template for generating expanded query variants. */
export const multiQueryPrompt =
  ChatPromptTemplate.fromTemplate(`You are an AI language model assistant. Your task is to generate {queryCount}
different versions of the given user question to retrieve relevant documents from a vector database.
By generating multiple perspectives on the user question, your goal is to help the user overcome some of
the limitations of the distance-based similarity search.
Provide these alternative questions separated by '{separator}'.
Original question: {question}`);
