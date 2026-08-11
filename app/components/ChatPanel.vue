<template>
    <div class="chat-panel" :style="{ width: chatWidth + 'px' }">
        <div v-if="nav.currentPath.value.length" class="path-bar px-3 py-1">
            <div class="d-flex ga-1 align-center flex-wrap">
                <span class="text-caption text-medium-emphasis mr-1">{{ graphTopic }} ·</span>
                <template v-for="(nodeId, i) in nav.currentPath.value" :key="nodeId">
                    <span v-if="i > 0" class="text-medium-emphasis text-caption">→</span>
                    <VChip :color="nodeId === nav.focusedNodeId.value ? 'primary' : undefined"
                        :variant="nodeId === nav.focusedNodeId.value ? 'flat' : 'outlined'"
                        size="x-small" label @click="nav.setFocused(nodeId)">
                        {{ nodeLabels[nodeId] ?? '#' + nodeId }}
                    </VChip>
                </template>
                <VSpacer />
                <span class="text-caption text-medium-emphasis">PgUp/Dn · Home/End</span>
            </div>
        </div>

        <div ref="msgContainer" class="msg-container">
            <div v-if="!nav.graphId.value" class="text-center text-medium-emphasis pa-4">
                Select or create a graph above
            </div>
            <div v-else-if="!pathMsgs.length && !streaming" class="text-center text-medium-emphasis pa-4">
                Focus a node and send a message
            </div>
            <div v-for="msg in pathMsgs" :key="msg.id" class="msg-wrapper"
                :class="msg.property?.role === 'user' ? 'user' : 'assistant'">
                <div v-if="msg.property?.deleted" class="msg-bubble deleted-msg">
                    <div class="msg-role text-medium-emphasis">[deleted]</div>
                </div>
                <div v-else class="msg-bubble">
                    <template v-if="editingId === msg.id">
                        <VTextarea v-model="editText" auto-grow hide-details density="compact" class="mb-1" />
                        <div class="d-flex ga-1">
                            <VBtn size="x-small" color="primary" :loading="saving" @click="saveEdit(msg)">Save</VBtn>
                            <VBtn size="x-small" variant="text" @click="editingId = null">Cancel</VBtn>
                        </div>
                    </template>
                    <template v-else>
                        <div class="msg-role">
                            {{ msg.property?.role === 'user' ? 'You' : msg.author }}
                            <span v-if="msg.property?.edited" class="text-warning text-caption ml-1">(edited)</span>
                        </div>
                        <div class="msg-content">
                            <MarkdownRender mode="chat" html-policy="escape" :katex="true"
                                :content="mdPreprocess(msg.property?.text ?? '')"
                                :final="true" :fade="false" :max-live-nodes="0" />
                        </div>
                        <div v-if="isOwn(msg)" class="msg-actions mt-1">
                            <VBtn icon="mdi-pencil" size="x-small" variant="text" density="compact"
                                @click="startEdit(msg)" />
                            <VBtn icon="mdi-delete-outline" size="x-small" variant="text" density="compact"
                                color="error" :loading="deletingId === msg.id" @click="delMsg(msg)" />
                        </div>
                    </template>
                </div>
            </div>
            <div v-if="streaming" class="msg-wrapper assistant">
                <div class="msg-bubble">
                    <div class="msg-role">{{ store.selectedModel }}</div>
                    <div class="msg-content">
                        <MarkdownRender mode="chat" html-policy="escape" :katex="true"
                            :content="mdPreprocess(streaming)" :final="false"
                            :smooth-streaming="true" :max-live-nodes="0" :fade="false" />
                    </div>
                </div>
            </div>
        </div>

        <div class="input-bar pa-2">
            <div class="d-flex ga-2">
                <VTextField v-model="input" label="Message" hide-details density="compact"
                    :disabled="loading" @keydown="onKey" />
                <VBtn :icon="loading ? 'mdi-stop' : 'mdi-send'"
                    :color="loading ? 'error' : 'primary'" variant="flat"
                    :disabled="!input.trim() && !loading"
                    @click="loading ? stop() : send()" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useChatStore } from "~/store/chat";
import type { graphNode } from "~~/server/db/schema/graph";

const store = useChatStore();
const nav = useGraphNav();

const input = ref("");
const loading = ref(false);
const streaming = ref("");
const msgContainer = ref<HTMLElement>();
let abort: AbortController | null = null;

const editingId = ref<number | null>(null);
const editText = ref("");
const saving = ref(false);
const deletingId = ref<number | null>(null);
const { data: session } = useAuth();
const userName = computed(() => session.value?.user?.name ?? session.value?.user?.email ?? "");

const chatWidth = ref(380);
const MIN_CHAT = 280;
const MAX_CHAT = 800;

function startResize(e: MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatWidth.value;
    function move(ev: MouseEvent) { chatWidth.value = Math.min(MAX_CHAT, Math.max(MIN_CHAT, startW + (startX - ev.clientX))); }
    function up() { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
}

function mdPreprocess(t: string): string {
    return t.replace(/\\\[/g, '$$$').replace(/\\\]/g, '$$$').replace(/\\\(/g, '$').replace(/\\\)/g, '$');
}

function isOwn(msg: graphNode) { return msg.author === userName.value && msg.property?.role === 'user'; }
function startEdit(msg: graphNode) { editingId.value = msg.id; editText.value = msg.property?.text ?? ''; }

async function saveEdit(msg: graphNode) {
    saving.value = true;
    try {
        await $fetch("/api/modNode", { method: "POST", body: { id: msg.id, property: { text: editText.value, role: msg.property!.role } } });
        nav.refreshTree(); editingId.value = null;
    } catch { /* */ }
    saving.value = false;
}

async function delMsg(msg: graphNode) {
    deletingId.value = msg.id;
    try { await $fetch(`/api/node?id=${msg.id}`, { method: "DELETE" }); nav.refreshTree(); } catch { /* */ }
    deletingId.value = null;
}

const pathMsgs = computed(() => {
    const path = nav.currentPath.value;
    if (path.length <= 1) return [];
    return path.slice(1).map((id: number) => nav.tree.value?.nodes.find((n: graphNode) => n.id === id)).filter(Boolean) as graphNode[];
});

const nodeLabels = computed(() => {
    const map: Record<number, string> = {};
    if (nav.tree.value) for (const n of nav.tree.value.nodes) {
        const t = n.property?.text ?? '';
        map[n.id] = (n.property?.deleted ? '[del] ' : '') + (t.slice(0, 12) || '#' + n.id);
    }
    return map;
});

const graphTopic = computed(() => {
    const g = nav.graphs.value.find((gr: { id: number; property: { topic: string } | null }) => gr.id === nav.graphId.value);
    return g?.property?.topic ?? 'Conversation';
});

function onKey(e: KeyboardEvent) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }

async function scroll() { await nextTick(); if (msgContainer.value) msgContainer.value.scrollTop = msgContainer.value.scrollHeight; }

function stop() {
    abort?.abort(); abort = null;
    if (streaming.value) {
        $fetch<number>("/api/node", { method: "POST", body: { parent: nav.currentPath.value.at(-1), author: store.selectedModel, property: { text: streaming.value, role: "assistant" } } })
            .then(id => { if (id) nav.setFocused(id); nav.refreshTree(); });
    }
    streaming.value = ""; loading.value = false;
}

async function send() {
    const text = input.value.trim();
    if (!text || loading.value) return;
    if (!nav.graphId.value) return;
    input.value = ""; loading.value = true; streaming.value = ""; abort = new AbortController();
    try {
        const parentId = nav.focusedNodeId.value ?? nav.currentPath.value.at(-1)!;
        const userNodeId = await $fetch<number>("/api/node", { method: "POST", body: { parent: parentId, property: { text, role: "user" } } });
        nav.setFocused(userNodeId); nav.refreshTree(); await scroll();
        const stream = await store.client.chat.completions.create({ model: store.selectedModel, messages: buildCtx(text), stream: true }, { signal: abort.signal });
        for await (const c of stream) { streaming.value += c.choices[0]?.delta?.content || ""; await scroll(); }
        const aiNodeId = await $fetch<number>("/api/node", { method: "POST", body: { parent: userNodeId, author: store.selectedModel, property: { text: streaming.value, role: "assistant" } } });
        nav.setFocused(aiNodeId); nav.refreshTree(); streaming.value = "";
    } catch (e: any) {
        if (e.name === "AbortError") return;
        const errMsg = e.data?.message || e.message || "Error"; streaming.value = "";
        try { const errId = await $fetch<number>("/api/node", { method: "POST", body: { parent: nav.focusedNodeId.value, author: "system", property: { text: 'Error: ' + errMsg, role: "assistant" } } }); if (errId) nav.setFocused(errId); } catch { /* */ }
    } finally { loading.value = false; abort = null; }
}

function buildCtx(userText: string) {
    const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [{ role: "system", content: graphTopic.value }];
    for (const n of pathMsgs.value) { if (n.property?.deleted) continue; msgs.push({ role: (n.property?.role as "user" | "assistant") ?? "user", content: n.property?.text ?? "" }); }
    msgs.push({ role: "user", content: userText });
    return msgs;
}

defineExpose({ chatWidth, startResize });
</script>

<style scoped>
.chat-panel { border: 1px solid rgba(var(--v-theme-on-surface), 0.18); border-radius: 4px; display: flex; flex-direction: column; flex-shrink: 0; background: rgb(var(--v-theme-surface)); height: 100%; }
.path-bar { background: rgba(var(--v-theme-primary), 0.12); border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1); }
.msg-container { flex: 1; overflow-y: auto; padding: 8px; min-height: 0; }
.msg-wrapper { display: flex; margin-bottom: 8px; }
.msg-wrapper.user { justify-content: flex-end; }
.msg-wrapper.assistant { justify-content: flex-start; }
.msg-bubble { max-width: 85%; padding: 6px 10px; border-radius: 10px; font-size: 0.85rem; }
.user .msg-bubble { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); border-bottom-right-radius: 3px; }
.assistant .msg-bubble { background: rgb(var(--v-theme-on-surface-variant)); color: rgb(var(--v-theme-on-surface)); border-bottom-left-radius: 3px; }
.deleted-msg { background: transparent !important; font-style: italic; }
.msg-role { font-size: 0.7rem; font-weight: 600; opacity: 0.7; }
.msg-actions { display: flex; gap: 2px; justify-content: flex-end; }
.msg-content { white-space: pre-wrap; word-break: break-word; }
.input-bar { background: rgb(var(--v-theme-surface)); border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12); }
</style>
