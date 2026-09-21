import { RAGChat } from "../lib/src";

const baseOptions = {
  openAIApiKey: "663c656ce73e4d87a246a9a77c22f8da.SKNHh09hoRu6C6Ce",
  apiKey: "663c656ce73e4d87a246a9a77c22f8da.SKNHh09hoRu6C6Ce",
  openAIBase: "https://open.bigmodel.cn/api/paas/v4/",
  configuration: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  },
};

const rag = new RAGChat({
  chatModel: {
    model: "glm-5.2",
    temperature: 0.7,
    ...baseOptions,
  },
  embeddingModelOptions: {
    model: "embedding-3",
    ...baseOptions,
  },
  category: ["系统更新日志"],
  questionCategory: [["系统更新日志", "涉及到询问系统等相关问题时"]],
});

document.querySelector<HTMLDivElement>("#app")!.innerHTML = ``;
