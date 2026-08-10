<template>
	<v-card class="chat-container">
		<!-- Header -->
		<v-card-item>
			<template #title>Chat</template>
			<template #subtitle>
				<v-btn
					size="small"
					variant="text"
					:prepend-icon="
						showSystemPrompt ? 'mdi-chevron-up' : 'mdi-chevron-down'
					"
					@click="showSystemPrompt = !showSystemPrompt">
					System Prompt
				</v-btn>
				<v-btn
					size="small"
					variant="text"
					color="warning"
					prepend-icon="mdi-delete-outline"
					@click="store.clearMessages()">
					Clear
				</v-btn>
			</template>
		</v-card-item>

		<!-- Settings (collapsible) -->
		<v-card-text v-show="showSystemPrompt">
			<v-text-field
				v-model="store.apiKey"
				label="API Key"
				type="password"
				density="compact"
				hide-details
				@change="fetchModels" />
			<v-text-field
				v-model="store.baseURL"
				label="Base URL"
				density="compact"
				hide-details
				class="mt-2"
				@change="fetchModels" />
			<v-textarea
				v-model="store.systemPrompt"
				label="System Prompt"
				rows="2"
				auto-grow
				hide-details
				class="mt-2" />
			<v-select
				v-model="store.selectedModel"
				:items="availableModels"
				label="Model"
				density="compact"
				class="mt-2"
				:loading="loadingModels"
				hide-details />
		</v-card-text>

		<v-divider />

		<!-- Messages -->
		<v-card-text ref="messagesContainer" class="messages-container">
			<div
				v-if="store.chatMessages.length === 0 && !streamingContent"
				class="text-center text-medium-emphasis py-8">
				Send a message to start chatting
			</div>
			<div
				v-for="(msg, i) in store.chatMessages"
				:key="i"
				class="message-wrapper"
				:class="msg.role">
				<div class="message-bubble">
					<div class="message-role">
						{{ msg.role === "user" ? "You" : "AI" }}
					</div>
					<div class="message-content" v-text="msg.content"></div>
				</div>
			</div>
			<!-- Streaming message -->
			<div v-if="streamingContent" class="message-wrapper assistant">
				<div class="message-bubble">
					<div class="message-role">AI</div>
					<div class="message-content">
						{{ streamingContent
						}}<span class="cursor-blink">|</span>
					</div>
				</div>
			</div>
		</v-card-text>

		<v-divider />

		<!-- Input -->
		<v-card-actions>
			<v-text-field
				v-model="input"
				label="Type a message... (Enter to send, Shift+Enter for newline)"
				hide-details
				:disabled="isLoading"
				@keydown="handleKeydown" />
			<v-btn
				:icon="isLoading ? 'mdi-stop' : 'mdi-send'"
				:color="isLoading ? 'error' : 'primary'"
				variant="flat"
				:disabled="!input.trim() && !isLoading"
				@click="isLoading ? stopStreaming() : send()" />
		</v-card-actions>
	</v-card>
</template>

<script lang="ts" setup>
import { useChatStore } from "~/store/chat";

const store = useChatStore();

const showSystemPrompt = ref(true);

const availableModels = ref<string[]>(["gpt-4o-mini", "gpt-4o"]);
const loadingModels = ref(false);

const input = ref("");
const isLoading = ref(false);
const streamingContent = ref("");
const messagesContainer = ref<HTMLElement>();

// Abort controller for stopping generation
let abortController: AbortController | null = null;

// Fetch available models
async function fetchModels() {
	if (!store.apiKey || store.apiKey === "a") return;
	loadingModels.value = true;
	try {
		const client = store.client;
		const response = await client.models.list();
		availableModels.value = response.data
			.map((m: { id: string }) => m.id)
			.filter(
				(id: string) =>
					id.startsWith("gpt") ||
					id.includes("claude") ||
					id.includes("deepseek")
			)
			.sort();
		if (availableModels.value.length === 0) {
			// Fallback: include all model IDs
			availableModels.value = response.data
				.map((m: { id: string }) => m.id)
				.sort();
		}
	} catch {
		// Keep defaults if fetch fails (e.g., custom endpoint doesn't support /models)
		console.warn("Failed to fetch models, using defaults");
	}
	loadingModels.value = false;
}

// Fetch models on mount
onMounted(() => {
	fetchModels();
});

// Keyboard handler: Enter sends, Shift+Enter inserts newline
function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		send();
	}
}

// Scroll messages to bottom
async function scrollToBottom() {
	await nextTick();
	if (messagesContainer.value) {
		messagesContainer.value.scrollTop =
			messagesContainer.value.scrollHeight;
	}
}

// Stop streaming
function stopStreaming() {
	abortController?.abort();
	abortController = null;
	// Save what we have so far
	if (streamingContent.value) {
		store.chatMessages.push({
			role: "assistant",
			content: streamingContent.value,
		});
	}
	streamingContent.value = "";
	isLoading.value = false;
}

// Send message
async function send() {
	const text = input.value.trim();
	if (!text || isLoading.value) return;

	// Add user message
	store.chatMessages.push({ role: "user", content: text });
	input.value = "";
	await scrollToBottom();

	// Start streaming
	isLoading.value = true;
	streamingContent.value = "";
	abortController = new AbortController();

	try {
		const client = store.client;
		const stream = await client.chat.completions.create(
			{
				model: store.selectedModel,
				messages: [
					{ role: "system", content: store.systemPrompt },
					...store.chatMessages.map(m => ({
						role: m.role,
						content: m.content,
					})),
				],
				stream: true,
			},
			{ signal: abortController.signal }
		);

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta?.content || "";
			streamingContent.value += delta;
			await scrollToBottom();
		}

		// Streaming complete — move to messages
		store.chatMessages.push({
			role: "assistant",
			content: streamingContent.value,
		});
		streamingContent.value = "";
	} catch (e: any) {
		if (e.name === "AbortError") return; // User stopped, already handled
		// Append error to messages
		store.chatMessages.push({
			role: "assistant",
			content: `Error: ${e.message || "Unknown error"}`,
		});
		streamingContent.value = "";
	} finally {
		isLoading.value = false;
		abortController = null;
	}
}
</script>

<style scoped>
.chat-container {
	max-width: 800px;
	margin: 0 auto;
	height: calc(100vh - 120px);
	display: flex;
	flex-direction: column;
}

.messages-container {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
}

.message-wrapper {
	display: flex;
	margin-bottom: 12px;
}

.message-wrapper.user {
	justify-content: flex-end;
}

.message-wrapper.assistant {
	justify-content: flex-start;
}

.message-bubble {
	max-width: 80%;
	padding: 10px 14px;
	border-radius: 12px;
}

.user .message-bubble {
	background-color: rgb(var(--v-theme-primary));
	color: rgb(var(--v-theme-on-primary));
	border-bottom-right-radius: 4px;
}

.assistant .message-bubble {
	background-color: rgb(var(--v-theme-surface));
	color: rgb(var(--v-theme-on-surface));
	border-bottom-left-radius: 4px;
}

.message-role {
	font-size: 0.75rem;
	font-weight: 600;
	margin-bottom: 4px;
	opacity: 0.7;
}

.message-content {
	white-space: pre-wrap;
	word-break: break-word;
}

.cursor-blink {
	animation: blink 1s step-end infinite;
}

@keyframes blink {
	50% {
		opacity: 0;
	}
}
</style>
