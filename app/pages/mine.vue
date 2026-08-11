<template>
    <div class="mine-container">
        <v-card max-width="640" class="mx-auto" elevation="8">
            <v-card-item>
                <template #title>
                    <div class="text-h5">My Account</div>
                </template>
                <template #subtitle>
                    <div class="mt-1">
                        <div>{{ session?.user?.name }}</div>
                        <div class="text-medium-emphasis">{{ session?.user?.email }}</div>
                    </div>
                </template>
            </v-card-item>

            <v-card-actions>
                <v-btn
                    color="error"
                    variant="outlined"
                    prepend-icon="mdi-delete-outline"
                    @click="confirmDelete = true"
                >
                    Delete Account
                </v-btn>
                <v-spacer />
                <v-btn variant="text" prepend-icon="mdi-logout" @click="signOut()">
                    Sign Out
                </v-btn>
            </v-card-actions>

            <v-divider />

            <v-card-item>
                <template #title>My Posts</template>
                <template #subtitle>
                    <span class="text-medium-emphasis">
                        {{ nodes.length }} post{{ nodes.length !== 1 ? "s" : "" }}
                    </span>
                </template>
            </v-card-item>

            <v-card-text>
                <div v-if="loading" class="text-center py-4">
                    <v-progress-circular indeterminate />
                </div>

                <div v-else-if="nodes.length === 0" class="text-center text-medium-emphasis py-4">
                    No posts yet
                </div>

                <v-list v-else lines="two">
                    <v-list-item
                        v-for="node in nodes"
                        :key="node.id"
                        :title="node.property?.text || '(empty)'"
                        :subtitle="`#${node.id} · ${new Date(node.createdAt).toLocaleDateString()}`"
                    />
                </v-list>
            </v-card-text>
        </v-card>

        <v-dialog v-model="confirmDelete" max-width="400">
            <v-card>
                <v-card-item title="Delete Account" />
                <v-card-text>
                    This will permanently delete your account and all your posts. This action cannot
                    be undone.
                </v-card-text>
                <v-card-actions>
                    <v-btn variant="text" @click="confirmDelete = false">Cancel</v-btn>
                    <v-spacer />
                    <v-btn color="error" :loading="deleting" @click="handleDelete"> Delete </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts" setup>
import type { graphNode } from "~~/server/db/schema/graph";

const { data: session, signOut } = useAuth();

const nodes = ref<graphNode[]>([]);
const loading = ref(true);
const confirmDelete = ref(false);
const deleting = ref(false);

onMounted(async () => {
    try {
        nodes.value = await $fetch("/api/mine/nodes");
    } catch {
        nodes.value = [];
    }
    loading.value = false;
});

async function handleDelete() {
    deleting.value = true;
    try {
        await $fetch("/api/deleteAccount", { method: "POST" });
        await signOut();
    } catch {
        deleting.value = false;
        confirmDelete.value = false;
    }
}
</script>

<style scoped>
.mine-container {
    max-width: 640px;
    margin: 0 auto;
}
</style>
