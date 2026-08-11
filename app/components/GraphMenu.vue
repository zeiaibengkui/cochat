<template>
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
                        $emit('visibilityChange');
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
</template>

<script lang="ts" setup>
import { useChatStore } from "~/store/chat";
import { useGraphStore } from "~/store/graph";
import type { GraphSelect } from "~~/server/db/schema/graph";

const store = useChatStore();
const gStore = useGraphStore();

defineEmits<{ visibilityChange: [] }>();

const showSettings = ref(false);
const selected = ref<any>(null);
const creating = ref(false);

const graphItems = computed(() =>
    gStore.graphs.map((g) => ({
        ...g,
        _title: g.property?.topic ? `${g.property.topic} #${g.id}` : `Graph #${g.id}`,
    })),
);

const nav = useGraphNav();
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
</script>
