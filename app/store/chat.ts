import OpenAI from "openai";
import { defineStore } from "pinia";

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export const useChatStore = defineStore("chat", {
    state: () => ({
        apiKey: "a",
        baseURL: "b",
        systemPrompt: "You are a helpful assistant.",
        selectedModel: "gpt-4o-mini",
        chatMessages: [] as ChatMessage[],
        showAllBranches: false,
        models: [] as string[],
        loadingModels: false,
    }),
    actions: {
        clearMessages() { this.chatMessages = []; },
        async fetchModels() {
            if (!this.apiKey || this.apiKey === "a") return;
            this.loadingModels = true;
            try {
                const r = await this.client.models.list();
                this.models = r.data.map((m: { id: string }) => m.id)
                    .filter((id: string) => id.startsWith("gpt") || id.includes("claude") || id.includes("deepseek")).sort();
                if (!this.models.length) this.models = r.data.map((m: { id: string }) => m.id).sort();
            } catch { /* */ }
            this.loadingModels = false;
        },
    },
    getters: {
        client: state => new OpenAI({ apiKey: state.apiKey, baseURL: state.baseURL, dangerouslyAllowBrowser: true }),
    },
    persist: true,
});
