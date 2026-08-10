<template>
    <div class="overview-container">
        <!-- Toolbar -->
        <VCard class="ma-2">
            <VCardText>
                <div class="d-flex ga-2 align-center flex-wrap">
                    <VSelect v-model="selected" :items="graphItems"
                        item-title="_title" return-object
                        label="Graph" hide-details class="flex-grow-1"
                        @update:model-value="onSelect" />
                    <VBtn variant="tonal" color="primary" :loading="creating"
                        @click="newGraph">
                        New
                    </VBtn>
                    <VBtn variant="text" size="small"
                        :prepend-icon="showSettings ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                        @click="showSettings = !showSettings">
                        Settings
                    </VBtn>
                    <VBtn variant="text" size="small"
                        :icon="store.showAllBranches ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                        @click="store.showAllBranches = !store.showAllBranches; applyVisibility()">
                        {{ store.showAllBranches ? 'All' : 'Main' }}
                    </VBtn>
                </div>
                <!-- Settings -->
                <div v-if="showSettings" class="mt-2">
                    <VTextField v-model="store.apiKey" label="API Key" type="password"
                        density="compact" hide-details @change="fetchModels" />
                    <VTextField v-model="store.baseURL" label="Base URL"
                        density="compact" hide-details class="mt-1" @change="fetchModels" />
                    <VTextarea v-model="store.systemPrompt" label="System Prompt"
                        rows="1" auto-grow hide-details class="mt-1" />
                    <VSelect v-model="store.selectedModel" :items="models" label="Model"
                        density="compact" class="mt-1" :loading="loadingModels" hide-details />
                </div>
            </VCardText>
        </VCard>

        <!-- Cytoscape + Chat split -->
        <div class="main-area">
            <!-- Cytoscape -->
            <div ref="cyContainer" class="cy-panel" />

            <!-- Chat panel -->
            <div class="chat-panel">
                <!-- Path bar -->
                <div v-if="nav.currentPath.value.length" class="path-bar px-3 py-1">
                    <div class="d-flex ga-1 align-center flex-wrap">
                        <span class="text-caption text-medium-emphasis mr-1">
                            {{ graphTopic }} ·
                        </span>
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

                <!-- Messages -->
                <div ref="msgContainer" class="msg-container">
                    <div v-if="!nav.graphId.value" class="text-center text-medium-emphasis pa-4">
                        Select or create a graph above
                    </div>
                    <div v-else-if="!pathMsgs.length && !streaming" class="text-center text-medium-emphasis pa-4">
                        Focus a node and send a message
                    </div>
                    <div v-for="msg in pathMsgs" :key="msg.id"
                        class="msg-wrapper" :class="msg.property?.role === 'user' ? 'user' : 'assistant'">
                        <div v-if="msg.property?.deleted" class="msg-bubble deleted-msg">
                            <div class="msg-role text-medium-emphasis">[deleted]</div>
                        </div>
                        <div v-else class="msg-bubble">
                            <template v-if="editingId === msg.id">
                                <VTextarea v-model="editText" auto-grow hide-details density="compact"
                                    class="mb-1" />
                                <div class="d-flex ga-1">
                                    <VBtn size="x-small" color="primary" :loading="saving" @click="saveEdit(msg)">
                                        Save
                                    </VBtn>
                                    <VBtn size="x-small" variant="text" @click="editingId = null">
                                        Cancel
                                    </VBtn>
                                </div>
                            </template>
                            <template v-else>
                                <div class="msg-role">
                                    {{ msg.property?.role === 'user' ? 'You' : msg.author }}
                                    <span v-if="msg.property?.edited" class="text-warning text-caption ml-1">(edited)</span>
                                </div>
                                <div class="msg-content" v-text="msg.property?.text" />
                                <!-- Edit/delete for own user messages -->
                                <div v-if="isOwn(msg)" class="msg-actions mt-1">
                                    <VBtn icon="mdi-pencil" size="x-small" variant="text" density="compact"
                                        @click="startEdit(msg)" />
                                    <VBtn icon="mdi-delete-outline" size="x-small" variant="text" density="compact"
                                        color="error" :loading="deletingId === msg.id"
                                        @click="delMsg(msg)" />
                                </div>
                            </template>
                        </div>
                    </div>
                    <div v-if="streaming" class="msg-wrapper assistant">
                        <div class="msg-bubble">
                            <div class="msg-role">{{ store.selectedModel }}</div>
                            <div class="msg-content">{{ streaming }}<span class="cursor-blink">|</span></div>
                        </div>
                    </div>
                </div>

                <!-- Input -->
                <div class="input-bar pa-2">
                    <div class="d-flex ga-2">
                        <VTextField v-model="input" label="Message" hide-details
                            density="compact" :disabled="loading"
                            @keydown="onKey" />
                        <VBtn :icon="loading ? 'mdi-stop' : 'mdi-send'"
                            :color="loading ? 'error' : 'primary'" variant="flat"
                            :disabled="!input.trim() && !loading"
                            @click="loading ? stop() : send()" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import cytoscape from "cytoscape";
import { useChatStore } from "~/store/chat";
import type { GraphSelect, graphNode } from "~~/server/db/schema/graph";

const store = useChatStore();
const nav = useGraphNav();
const router = useRouter();

const showSettings = ref(false);
const models = ref<string[]>([store.selectedModel]);
const loadingModels = ref(false);
const selected = ref<GraphSelect | null>(null);
const creating = ref(false);

const input = ref("");
const loading = ref(false);
const streaming = ref("");
const msgContainer = ref<HTMLElement>();
const cyContainer = ref<HTMLElement>();
let cy: cytoscape.Core | null = null;
let abort: AbortController | null = null;

// Edit/delete state
const editingId = ref<number | null>(null);
const editText = ref("");
const saving = ref(false);
const deletingId = ref<number | null>(null);
const { data: session } = useAuth();
const userName = computed(() => session.value?.user?.name ?? session.value?.user?.email ?? "");
function isOwn(msg: graphNode) { return msg.author === userName.value && msg.property?.role === 'user'; }

function startEdit(msg: graphNode) {
    editingId.value = msg.id;
    editText.value = msg.property?.text ?? '';
}

async function saveEdit(msg: graphNode) {
    saving.value = true;
    try {
        await $fetch("/api/modNode", {
            method: "POST",
            body: { id: msg.id, property: { text: editText.value, role: msg.property!.role } },
        });
        nav.refreshTree();
        editingId.value = null;
    } catch { /* */ }
    saving.value = false;
}

async function delMsg(msg: graphNode) {
    deletingId.value = msg.id;
    try {
        await $fetch(`/api/node?id=${msg.id}`, { method: "DELETE" });
        nav.refreshTree();
    } catch { /* */ }
    deletingId.value = null;
}

// Current chain messages (root excluded)
const pathMsgs = computed(() => {
    const path = nav.currentPath.value;
    if (path.length <= 1) return [];
    return path.slice(1)
        .map(id => nav.tree.value?.nodes.find(n => n.id === id))
        .filter(Boolean) as graphNode[];
});

const nodeLabels = computed(() => {
    const map: Record<number, string> = {};
    if (nav.tree.value) {
        for (const n of nav.tree.value.nodes) {
            const t = n.property?.text ?? '';
            map[n.id] = (n.property?.deleted ? '[del] ' : '') + (t.slice(0, 12) || '#' + n.id);
        }
    }
    return map;
});

// Graph items with unique display titles to avoid Vuetify duplicate-ID warnings
const graphItems = computed(() => nav.graphs.value.map(g => ({
    ...g,
    _title: g.property?.topic ? `${g.property.topic} #${g.id}` : `Graph #${g.id}`,
})));

const graphTopic = computed(() => {
    const g = nav.graphs.value.find(g => g.id === nav.graphId.value);
    return g?.property?.topic ?? 'Conversation';
});

// Init from URL
watch(graphItems, (list) => {
    if (!list.length) return;
    const gid = nav.graphId.value;
    if (gid) selected.value = list.find(g => g.id === gid) ?? null;
}, { immediate: true });

function onSelect(g: GraphSelect | null) {
    if (g) nav.setGraph(g.id);
}

async function newGraph() {
    creating.value = true;
    try {
        const g = await $fetch<GraphSelect>("/api/modGraph", {
            method: "POST",
            body: { topic: store.systemPrompt || "New conversation" },
        });
        nav.graphs.value.push(g);
        selected.value = null; // will be set by watch
        await router.replace({ query: { graph: g.id, node: g.root } });
    } catch { /* */ }
    creating.value = false;
}

// --- Cytoscape ---
watch(nav.tree, async (t) => {
    cy?.destroy();
    if (!t || !cyContainer.value) return;
    await nextTick();

    cy = cytoscape({
        container: cyContainer.value,
        elements: [
            ...t.nodes.map(n => ({
                data: {
                    id: String(n.id),
                    label: (n.property?.deleted ? '🗑 ' : '') + (n.property?.text?.slice(0, 25) ?? '#' + n.id),
                    role: n.property?.role ?? 'user',
                    deleted: n.property?.deleted ? 'true' : 'false',
                },
            })),
            ...t.edges.map(e => ({
                data: { id: e.source + '->' + e.target, source: String(e.source), target: String(e.target) },
            })),
        ],
        style: [
            { selector: "node", style: { label: "data(label)", "font-size": "10px", "background-color": "#1976D2", color: "#fff", "text-valign": "center", "text-halign": "center", "text-wrap": "wrap", "text-max-width": "100px", width: 36, height: 36 } },
            { selector: "node[role='assistant']", style: { "background-color": "#2E7D32" } },
            { selector: "node[deleted='true']", style: { "background-color": "#616161", "text-opacity": 0.5 } },
            { selector: "edge", style: { "line-color": "#666", "target-arrow-color": "#666", "target-arrow-shape": "triangle", "curve-style": "bezier", width: 2 } },
        ],
        layout: { name: "breadthfirst", directed: true, spacingFactor: 1.2 },
    });

    cy.on("tap", "node", (evt) => nav.setFocused(Number(evt.target.id())));
    applyVisibility();
}, { immediate: true });

// Watch for path changes to update visibility
watch([nav.currentPath, () => store.showAllBranches], () => applyVisibility());

function applyVisibility() {
    if (!cy) return;
    if (store.showAllBranches) {
        cy.elements().style("opacity", 1).style("display", "element");
        return;
    }
    const pathSet = new Set(nav.currentPath.value);
    const dimmedSet = new Set<number>();
    // Dim direct children of path nodes that are NOT on the path
    for (const pid of pathSet) {
        const kids = cy.getElementById(String(pid)).outgoers("node");
        kids.forEach(k => {
            const kidId = Number(k.id());
            if (!pathSet.has(kidId)) dimmedSet.add(kidId);
        });
    }
    cy.nodes().forEach(n => {
        const nid = Number(n.id());
        if (pathSet.has(nid)) {
            n.style("opacity", 1).style("display", "element");
        } else if (dimmedSet.has(nid)) {
            n.style("opacity", 0.4).style("display", "element");
        } else {
            n.style("display", "none");
        }
    });
    // Always show edges connected to visible nodes
    cy.edges().forEach(e => {
        const src = Number(e.source().id());
        const tgt = Number(e.target().id());
        if (pathSet.has(src) || dimmedSet.has(src)) {
            const tgtVisible = pathSet.has(tgt) || dimmedSet.has(tgt);
            e.style("display", tgtVisible ? "element" : "none");
            e.style("opacity", dimmedSet.has(src) || dimmedSet.has(tgt) ? 0.4 : 1);
        } else {
            e.style("display", "none");
        }
    });
}

watch(nav.focusedNodeId, (id) => {
    if (!cy) return;
    cy.elements().removeClass("focused");
    if (id) cy.getElementById(String(id)).addClass("focused");
});

onMounted(() => {
    const s = document.createElement("style");
    s.textContent = '.cy-panel .focused { border-width: 3px; border-color: #FF5722; }';
    document.head.appendChild(s);
});

// --- Chat ---
async function fetchModels() {
    if (!store.apiKey || store.apiKey === "a") return;
    loadingModels.value = true;
    try {
        const r = await store.client.models.list();
        models.value = r.data.map((m: { id: string }) => m.id)
            .filter((id: string) => id.startsWith("gpt") || id.includes("claude") || id.includes("deepseek")).sort();
        if (!models.value.length) models.value = r.data.map((m: { id: string }) => m.id).sort();
    } catch { /* */ }
    loadingModels.value = false;
}
onMounted(() => fetchModels());

function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
}

async function scroll() {
    await nextTick();
    if (msgContainer.value) msgContainer.value.scrollTop = msgContainer.value.scrollHeight;
}

function stop() {
    abort?.abort();
    abort = null;
    if (streaming.value) {
        $fetch<number>("/api/node", { method: "POST", body: { parent: nav.currentPath.value.at(-1), author: store.selectedModel, property: { text: streaming.value, role: "assistant" } } })
            .then(id => { if (id) nav.setFocused(id); nav.refreshTree(); });
    }
    streaming.value = "";
    loading.value = false;
}

async function send() {
    const text = input.value.trim();
    if (!text || loading.value) return;
    if (!nav.graphId.value) { await newGraph(); if (!nav.graphId.value) return; }

    input.value = "";
    loading.value = true;
    streaming.value = "";
    abort = new AbortController();

    try {
        const parentId = nav.focusedNodeId.value ?? nav.currentPath.value.at(-1)!;
        const userNodeId = await $fetch<number>("/api/node", {
            method: "POST",
            body: { parent: parentId, property: { text, role: "user" } },
        });
        nav.setFocused(userNodeId);
        nav.refreshTree();
        await scroll();

        const stream = await store.client.chat.completions.create(
            { model: store.selectedModel, messages: buildCtx(text), stream: true },
            { signal: abort.signal },
        );
        for await (const c of stream) {
            streaming.value += c.choices[0]?.delta?.content || "";
            await scroll();
        }

        const aiNodeId = await $fetch<number>("/api/node", {
            method: "POST",
            body: { parent: userNodeId, author: store.selectedModel, property: { text: streaming.value, role: "assistant" } },
        });
        nav.setFocused(aiNodeId);
        nav.refreshTree();
        streaming.value = "";
    } catch (e: any) {
        if (e.name === "AbortError") return;
        const errMsg = e.data?.message || e.message || "Error";
        streaming.value = "";
        try {
            const errId = await $fetch<number>("/api/node", {
                method: "POST",
                body: { parent: nav.focusedNodeId.value, author: "system", property: { text: 'Error: ' + errMsg, role: "assistant" } },
            });
            if (errId) nav.setFocused(errId);
        } catch { /* */ }
    } finally {
        loading.value = false;
        abort = null;
    }
}

function buildCtx(userText: string) {
    const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: graphTopic.value },
    ];
    for (const n of pathMsgs.value) {
        if (n.property?.deleted) continue;
        msgs.push({ role: (n.property?.role as "user" | "assistant") ?? "user", content: n.property?.text ?? "" });
    }
    msgs.push({ role: "user", content: userText });
    return msgs;
}
</script>

<style scoped>
.overview-container {
    height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
}

.main-area {
    flex: 1;
    display: flex;
    gap: 8px;
    margin: 0 8px 8px;
    min-height: 0;
}

.cy-panel {
    flex: 1;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
    border-radius: 4px;
    min-width: 300px;
    background: rgb(var(--v-theme-surface));
}

.chat-panel {
    width: 380px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: rgb(var(--v-theme-surface));
}

.path-bar {
    background: rgba(var(--v-theme-primary), 0.12);
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.msg-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    min-height: 0;
}

.msg-wrapper {
    display: flex;
    margin-bottom: 8px;
}
.msg-wrapper.user { justify-content: flex-end; }
.msg-wrapper.assistant { justify-content: flex-start; }

.msg-bubble {
    max-width: 85%;
    padding: 6px 10px;
    border-radius: 10px;
    font-size: 0.85rem;
}
.user .msg-bubble {
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
    border-bottom-right-radius: 3px;
}
.assistant .msg-bubble {
    background: rgb(var(--v-theme-surface-variant));
    color: rgb(var(--v-theme-on-surface));
    border-bottom-left-radius: 3px;
}
.deleted-msg {
    background: transparent !important;
    font-style: italic;
}

.msg-role { font-size: 0.7rem; font-weight: 600; opacity: 0.7; }
.msg-actions { display: flex; gap: 2px; justify-content: flex-end; }
.msg-content { white-space: pre-wrap; word-break: break-word; }

.input-bar {
    background: rgb(var(--v-theme-surface));
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.cursor-blink { animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
</style>
