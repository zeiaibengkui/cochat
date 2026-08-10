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
		// Chat state — all persisted via pinia-plugin-persistedstate
		systemPrompt: "You are a helpful assistant.",
		selectedModel: "gpt-4o-mini",
		chatMessages: [] as ChatMessage[],
			showAllBranches: false,
	}),
	actions: {
		clearMessages() {
			this.chatMessages = [];
		},
	},
	getters: {
		client: state =>
			new OpenAI({
				apiKey: state.apiKey,
				baseURL: state.baseURL,
				dangerouslyAllowBrowser: true,
			}),
	},
	persist: true,
});
