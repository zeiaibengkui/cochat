<template>
    <div class="overview-container">
        <VCard class="ma-2">
            <VCardText>
                <div class="d-flex ga-2 align-center flex-wrap">
                    <VSelect
                        v-model="selected"
                        :items="graphItems"
                        item-title="_title"
                        return-object
                        label="Graph"
                        hide-details
                        class="flex-grow-1"
                        @update:model-value="onSelect"
                    />
                    <VBtn variant="tonal" color="primary" :loading="creating" @click="newGraph"
                        >New</VBtn
                    >
                    <VBtn
                        variant="text"
                        size="small"
                        :prepend-icon="showSettings ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                        @click="showSettings = !showSettings"
                        >Settings</VBtn
                    >
                    <VBtn
                        variant="text"
                        size="small"
                        :icon="store.showAllBranches ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                        @click="
                            store.showAllBranches = !store.showAllBranches;
                            applyVisibility();
                        "
                    >
                        {{ store.showAllBranches ? "All" : "Main" }}
                    </VBtn>
                </div>
                <div v-if="showSettings" class="mt-2">
                    <VTextField
                        v-model="store.apiKey"
                        label="API Key"
                        type="password"
                        density="compact"
                        hide-details
                        @change="store.fetchModels()"
                    />
                    <VTextField
                        v-model="store.baseURL"
                        label="Base URL"
                        density="compact"
                        hide-details
                        class="mt-1"
                        @change="store.fetchModels()"
                    />
                    <VTextarea
                        v-model="store.systemPrompt"
                        label="System Prompt"
                        rows="1"
                        auto-grow
                        hide-details
                        class="mt-1"
                    />
                    <VSelect
                        v-model="store.selectedModel"
                        :items="store.models"
                        label="Model"
                        density="compact"
                        class="mt-1"
                        :loading="store.loadingModels"
                        hide-details
                    />
                </div>
            </VCardText>
        </VCard>

        <div class="main-area">
            <div ref="cyContainer" class="cy-panel" />
            <div class="resize-handle" @mousedown="startResize" />
            <ChatPanel ref="chatRef" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import cytoscape from "cytoscape";
import { useChatStore } from "~/store/chat";
import { useGraphStore } from "~/store/graph";
import ChatPanel from "~/components/ChatPanel.vue";
import type { GraphSelect } from "~~/server/db/schema/graph";

const store = useChatStore();
const gStore = useGraphStore();
const nav = useGraphNav();

const showSettings = ref(false);
const selected = ref<any>(null);
const creating = ref(false);
const cyContainer = ref<HTMLElement>();
const chatRef = ref<InstanceType<typeof ChatPanel>>();
let cy: cytoscape.Core | null = null;

function startResize(e: MouseEvent) {
    chatRef.value?.startResize(e);
}

const graphItems = computed(() =>
    gStore.graphs.map((g) => ({
        ...g,
        _title: g.property?.topic ? `${g.property.topic} #${g.id}` : `Graph #${g.id}`,
    })),
);

watch(
    graphItems,
    (list) => {
        if (!list.length) return;
        const gid = nav.graphId.value;
        if (gid) selected.value = list.find((g) => g.id === gid) ?? null;
    },
    { immediate: true },
);

function onSelect(g: GraphSelect | null) {
    if (g) gStore.setGraph(g.id);
}

async function newGraph() {
    creating.value = true;
    try {
        const g = await $fetch<GraphSelect>("/api/modGraph", {
            method: "POST",
            body: { topic: store.systemPrompt || "New conversation" },
        });
        gStore.graphs.push(g);
        selected.value = null;
        gStore.setGraphAndFocused(g.id, g.root);
    } catch {
        /* */
    }
    creating.value = false;
}

onMounted(() => store.fetchModels());

// --- Cytoscape ---
watch(
    () => gStore.tree,
    async (t) => {
        cy?.destroy();
        if (!t || !cyContainer.value) return;
        await nextTick();
        cy = cytoscape({
            container: cyContainer.value,
            elements: [
                ...t.nodes.map((n) => ({
                    data: {
                        id: String(n.id),
                        label:
                            (n.property?.deleted ? "🗑 " : "") +
                            (n.property?.text?.slice(0, 25) ?? "#" + n.id),
                        role: n.property?.role ?? "user",
                        deleted: n.property?.deleted ? "true" : "false",
                    },
                })),
                ...t.edges.map((e) => ({
                    data: {
                        id: e.source + "->" + e.target,
                        source: String(e.source),
                        target: String(e.target),
                    },
                })),
            ],
            style: [
                {
                    selector: "node",
                    style: {
                        label: "data(label)",
                        "font-size": "10px",
                        "background-color": "#1976D2",
                        color: "#fff",
                        "text-valign": "center",
                        "text-halign": "center",
                        "text-wrap": "wrap",
                        "text-max-width": "100px",
                        width: 36,
                        height: 36,
                    },
                },
                { selector: "node[role='assistant']", style: { "background-color": "#2E7D32" } },
                {
                    selector: "node[deleted='true']",
                    style: { "background-color": "#616161", "text-opacity": 0.5 },
                },
                {
                    selector: "edge",
                    style: {
                        "line-color": "#666",
                        "target-arrow-color": "#666",
                        "target-arrow-shape": "triangle",
                        "curve-style": "bezier",
                        width: 2,
                    },
                },
            ],
            layout: { name: "breadthfirst", directed: true, spacingFactor: 1.2 },
        });
        cy.on("tap", "node", (evt) => gStore.setFocused(Number(evt.target.id())));
        applyVisibility();
    },
    { immediate: true },
);

watch([nav.currentPath, () => store.showAllBranches], () => applyVisibility());

function applyVisibility() {
    if (!cy) return;
    if (store.showAllBranches) {
        cy.elements().style("opacity", 1).style("display", "element");
        return;
    }
    const pathSet = new Set(nav.currentPath.value);
    const dimmedSet = new Set<number>();
    for (const pid of pathSet) {
        cy.getElementById(String(pid))
            .outgoers("node")
            .forEach((k) => {
                const kidId = Number(k.id());
                if (!pathSet.has(kidId)) dimmedSet.add(kidId);
            });
    }
    cy.nodes().forEach((n) => {
        const nid = Number(n.id());
        if (pathSet.has(nid)) n.style("opacity", 1).style("display", "element");
        else if (dimmedSet.has(nid)) n.style("opacity", 0.4).style("display", "element");
        else n.style("display", "none");
    });
    cy.edges().forEach((e) => {
        const src = Number(e.source().id()),
            tgt = Number(e.target().id());
        if (pathSet.has(src) || dimmedSet.has(src)) {
            const visible = pathSet.has(tgt) || dimmedSet.has(tgt);
            e.style("display", visible ? "element" : "none").style(
                "opacity",
                dimmedSet.has(src) || dimmedSet.has(tgt) ? 0.4 : 1,
            );
        } else e.style("display", "none");
    });
}

watch(
    () => gStore.focusedNodeId,
    (id) => {
        if (!cy) return;
        cy.elements().removeClass("focused");
        if (id) cy.getElementById(String(id)).addClass("focused");
    },
);
onMounted(() => {
    const s = document.createElement("style");
    s.textContent = ".cy-panel .focused { border-width: 3px; border-color: #FF5722; }";
    document.head.appendChild(s);
});
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
    gap: 0;
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
.resize-handle {
    width: 6px;
    cursor: col-resize;
    flex-shrink: 0;
    background: transparent;
    transition: background 0.15s;
}
.resize-handle:hover {
    background: rgba(var(--v-theme-primary), 0.3);
}
</style>
