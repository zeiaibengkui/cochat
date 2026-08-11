<template>
    <ClientOnly>
        <VApp>
            <VAppBar>
                <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer" />
                COCHAT
                <v-spacer />
                <v-btn
                    :prepend-icon="
                        theme.current?.value?.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'
                    "
                    text="Toggle Theme"
                    slim
                    @click="theme.toggle()"
                />
            </VAppBar>

            <v-navigation-drawer v-model="drawer" temporary>
                <v-list>
                    <v-list-item title="Navigation" />
                    <v-list-item to="/" title="Index" />
                    <v-list-item to="graph" title="Graph" />
                    <v-divider class="my-2" />
                    <template v-if="status === 'authenticated'">
                        <v-list-item
                            to="/mine"
                            title="My Account"
                            prepend-icon="mdi-account-circle"
                        />
                        <v-list-item>
                            <template #title
                                ><span class="text-medium-emphasis text-caption"
                                    >Signed in as</span
                                ></template
                            >
                            <template #subtitle>{{ session?.user?.email }}</template>
                        </v-list-item>
                        <v-list-item
                            @click="signOut()"
                            title="Sign Out"
                            prepend-icon="mdi-logout"
                        />
                    </template>
                    <template v-else>
                        <v-list-item
                            to="/login"
                            title="Sign In / Register"
                            prepend-icon="mdi-login"
                        />
                    </template>
                </v-list>
            </v-navigation-drawer>

            <v-main class="ma-4">
                <NuxtPage />
            </v-main>
        </VApp>
    </ClientOnly>
</template>

<script setup lang="ts">
import { useTheme } from "vuetify";
const theme = useTheme();
const drawer = ref(false);
const { status, data: session, signOut } = useAuth();
</script>
