<template>
    <div class="auth-container">
        <v-card class="auth-card" max-width="420" elevation="8">
            <v-card-item>
                <template #title>
                    <div class="text-h4 text-center">cochat</div>
                </template>
                <template #subtitle>
                    <div class="text-center text-medium-emphasis mt-1">
                        {{ isRegister ? "Create your account" : "Sign in to continue" }}
                    </div>
                </template>
            </v-card-item>

            <v-card-text>
                <v-alert
                    v-if="error"
                    type="error"
                    closable
                    density="compact"
                    class="mb-4"
                    :text="error"
                    @click:close="error = ''"
                />

                <v-tabs v-model="tab" grow class="mb-4">
                    <v-tab value="login">Sign In</v-tab>
                    <v-tab value="register">Register</v-tab>
                </v-tabs>

                <!-- Login form -->
                <v-form v-if="tab === 'login'" @submit.prevent="handleLogin">
                    <v-text-field
                        v-model="email"
                        label="Email"
                        type="email"
                        prepend-inner-icon="mdi-email-outline"
                        :disabled="loading"
                        required
                    />
                    <v-text-field
                        v-model="password"
                        label="Password"
                        type="password"
                        prepend-inner-icon="mdi-lock-outline"
                        :disabled="loading"
                        required
                    />
                    <v-btn
                        type="submit"
                        color="primary"
                        block
                        size="large"
                        :loading="loading"
                        class="mt-2"
                    >
                        Sign In
                    </v-btn>
                </v-form>

                <!-- Register form -->
                <v-form v-else @submit.prevent="handleRegister">
                    <v-text-field
                        v-model="name"
                        label="Name"
                        prepend-inner-icon="mdi-account-outline"
                        :disabled="loading"
                        required
                    />
                    <v-text-field
                        v-model="email"
                        label="Email"
                        type="email"
                        prepend-inner-icon="mdi-email-outline"
                        :disabled="loading"
                        required
                    />
                    <v-text-field
                        v-model="password"
                        label="Password"
                        type="password"
                        prepend-inner-icon="mdi-lock-outline"
                        :disabled="loading"
                        hint="At least 6 characters"
                        required
                    />
                    <v-text-field
                        v-model="confirmPassword"
                        label="Confirm Password"
                        type="password"
                        prepend-inner-icon="mdi-lock-check-outline"
                        :disabled="loading"
                        :rules="[(v) => v === password || 'Passwords do not match']"
                        required
                    />
                    <v-btn
                        type="submit"
                        color="primary"
                        block
                        size="large"
                        :loading="loading"
                        class="mt-2"
                    >
                        Register
                    </v-btn>
                </v-form>
            </v-card-text>
        </v-card>
    </div>
</template>

<script lang="ts" setup>
definePageMeta({
    auth: { unauthenticatedOnly: true },
});

const { signIn } = useAuth();

const tab = ref("login");
const isRegister = computed(() => tab.value === "register");

const name = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const error = ref("");
const loading = ref(false);

async function handleLogin() {
    error.value = "";
    loading.value = true;

    try {
        const result = await signIn("credentials", {
            email: email.value,
            password: password.value,
            redirect: false,
        });

        if (result?.error) {
            error.value = "Invalid email or password";
        } else {
            await navigateTo("/");
        }
    } catch {
        error.value = "Login failed. Please try again.";
    } finally {
        loading.value = false;
    }
}

async function handleRegister() {
    error.value = "";

    if (password.value !== confirmPassword.value) {
        error.value = "Passwords do not match";
        return;
    }

    loading.value = true;

    try {
        await $fetch("/api/auth/register", {
            method: "POST",
            body: { name: name.value, email: email.value, password: password.value },
        });

        // Auto-login after successful registration
        const result = await signIn("credentials", {
            email: email.value,
            password: password.value,
            redirect: false,
        });

        if (result?.error) {
            // Registration succeeded but auto-login failed — switch to login tab
            error.value = "Account created! Please sign in.";
            tab.value = "login";
        } else {
            await navigateTo("/");
        }
    } catch (e: any) {
        error.value = e.data?.message || "Registration failed. Please try again.";
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 70vh;
}

.auth-card {
    width: 100%;
}
</style>
