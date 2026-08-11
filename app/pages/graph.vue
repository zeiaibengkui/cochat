<template>
    <div class="overview-container">
        <GraphMenu @visibility-change="gStore.applyVisibility(store.showAllBranches)" />

        <div class="main-area">
            <div ref="cyContainer" class="cy-panel" />
            <div class="resize-handle" @mousedown="startResize" />
            <ChatPanel ref="chatRef" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useChatStore } from "~/store/chat";
import { useGraphStore } from "~/store/graph";
import ChatPanel from "~/components/ChatPanel.vue";

const store = useChatStore();
const gStore = useGraphStore();
const nav = useGraphNav();

const cyContainer = ref<HTMLElement>();
const chatRef = ref<InstanceType<typeof ChatPanel>>();

function startResize(e: MouseEvent) {
    chatRef.value?.startResize(e);
}

onMounted(() => {
    store.fetchModels();
    const s = document.createElement("style");
    s.textContent = ".cy-panel .focused { border-width: 3px; border-color: #FF5722; }";
    document.head.appendChild(s);
});

watch(
    () => gStore.tree,
    async (t) => {
        if (!t || !cyContainer.value) return;
        await nextTick();
        gStore.initCy(cyContainer.value);
    },
    { immediate: true },
);

watch([nav.currentPath, () => store.showAllBranches], () =>
    gStore.applyVisibility(store.showAllBranches),
);
watch(
    () => gStore.focusedNodeId,
    () => gStore.highlightFocused(),
);
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
