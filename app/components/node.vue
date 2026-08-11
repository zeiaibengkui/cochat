<template>
    <VCard class="node-card" :class="{ 'root-node': depth === 0, 'deleted-node': isDeleted }">
        <VCardItem>
            <template v-if="editing">
                <VTextarea v-model="editText" label="Content" auto-grow hide-details autofocus />
                <div class="d-flex ga-2 mt-2">
                    <VBtn size="small" color="primary" :loading="saving" @click="saveNode">
                        Save
                    </VBtn>
                    <VBtn size="small" variant="text" @click="cancelEdit"> Cancel </VBtn>
                </div>
            </template>

            <template v-else>
                <VCardTitle
                    class="text-body-1 pa-0"
                    :class="{ 'text-decoration-line-through text-medium-emphasis': isDeleted }"
                >
                    {{ nodeText }}
                    <VChip
                        v-if="isEdited && !isDeleted"
                        size="x-small"
                        label
                        class="ml-1"
                        color="warning"
                    >
                        edited
                    </VChip>
                </VCardTitle>
                <VCardSubtitle v-if="nodeData" class="text-caption">
                    #{{ nodeData.id }}
                    <span v-if="nodeData.createdAt">
                        · {{ new Date(nodeData.createdAt).toLocaleDateString() }}
                    </span>
                </VCardSubtitle>
            </template>
        </VCardItem>

        <VCardActions v-if="!editing && !isDeleted">
            <VBtn size="small" variant="tonal" prepend-icon="mdi-plus" @click="addChild">
                Add
            </VBtn>
            <VBtn
                size="small"
                variant="text"
                prepend-icon="mdi-pencil"
                :disabled="!isAuthor"
                @click="startEdit"
            >
                Edit
            </VBtn>
            <VSpacer />
            <VBtn
                size="small"
                variant="text"
                color="error"
                prepend-icon="mdi-delete-outline"
                :disabled="!isAuthor"
                :loading="deleting"
                @click="confirmDelete = !confirmDelete"
            />
        </VCardActions>

        <!-- Delete confirmation -->
        <VExpandTransition>
            <VCardText v-if="confirmDelete" class="bg-surface-variant">
                <div class="text-caption mb-2">
                    Delete this message? It will be hidden but the conversation stays intact.
                </div>
                <div v-if="deleteError" class="text-error text-caption mb-2">{{ deleteError }}</div>
                <div class="d-flex ga-2">
                    <VBtn
                        size="small"
                        color="error"
                        variant="flat"
                        :loading="deleting"
                        @click="deleteNode"
                    >
                        Confirm
                    </VBtn>
                    <VBtn size="small" variant="text" @click="confirmDelete = false"> Cancel </VBtn>
                </div>
            </VCardText>
        </VExpandTransition>

        <div v-if="children?.length" class="children-container pl-6">
            <node
                v-for="child in children"
                :key="child.id"
                :id="child.id"
                :depth="depth + 1"
                @deleted="refresh()"
            />
        </div>
    </VCard>
</template>

<script lang="ts" setup>
import type { graphNode as NodeData } from "~~/server/db/schema/graph";

const props = withDefaults(defineProps<{ id: number; depth?: number }>(), {
    depth: 0,
});

const emit = defineEmits<{ deleted: [] }>();

const { data: session } = useAuth();

const { data: children, refresh } = await useFetch<NodeData[]>("/api/children", {
    params: { parent: props.id },
});

const { data: nodeData, refresh: refreshNode } = await useFetch<NodeData>("/api/node", {
    params: { id: props.id },
});

const nodeProp = computed(() => nodeData.value?.property);
const isDeleted = computed(() => nodeProp.value?.deleted === true);
const isEdited = computed(() => nodeProp.value?.edited === true);
const nodeText = computed(() => {
    if (isDeleted.value) return "[deleted]";
    return nodeProp.value?.text ?? "(empty)";
});
const userName = computed(() => session.value?.user?.name ?? session.value?.user?.email ?? "");
const isAuthor = computed(() => nodeData.value?.author === userName.value);

// Inline editing
const editing = ref(false);
const editText = ref("");
const saving = ref(false);

function startEdit() {
    editText.value = nodeProp.value?.text ?? "";
    editing.value = true;
}

function cancelEdit() {
    editing.value = false;
}

async function saveNode() {
    saving.value = true;
    try {
        await $fetch("/api/modNode", {
            method: "POST",
            body: {
                id: props.id,
                property: { text: editText.value, role: nodeProp.value?.role ?? "user" },
            },
        });
        await refreshNode();
        editing.value = false;
    } catch {
        /* handled */
    }
    saving.value = false;
}

async function addChild() {
    await $fetch("/api/node", {
        method: "POST",
        body: { parent: props.id, property: { text: "New node", role: "user" } },
    });
    await refresh();
}

// Soft delete
const confirmDelete = ref(false);
const deleting = ref(false);
const deleteError = ref("");

async function deleteNode() {
    deleting.value = true;
    deleteError.value = "";
    try {
        await $fetch(`/api/node?id=${props.id}`, { method: "DELETE" });
        await refreshNode();
        confirmDelete.value = false;
    } catch (e: unknown) {
        const err = e as { data?: { message?: string } };
        deleteError.value = err.data?.message || "Delete failed";
        confirmDelete.value = false;
    }
    deleting.value = false;
}
</script>

<style scoped>
.node-card {
    margin: 0.5rem 0;
    border-left: 3px solid rgb(var(--v-theme-primary));
}

.root-node {
    border-left-color: rgb(var(--v-theme-success));
}

.deleted-node {
    opacity: 0.5;
}

.children-container {
    border-left: 2px dashed rgb(var(--v-theme-surface-variant));
    margin-left: 1rem;
}
</style>
