<template>
	<div>
		<VApp>
			<VAppBar>
				<v-app-bar-nav-icon
					variant="text"
					@click.stop="drawer = !drawer"></v-app-bar-nav-icon>
				COCHAT

				<v-spacer></v-spacer>

				<v-btn
					:prepend-icon="
						theme.current?.value?.dark
							? 'mdi-weather-sunny'
							: 'mdi-weather-night'
					"
					text="Toggle Theme"
					slim
					@click="theme.toggle()"></v-btn>
			</VAppBar>

			<v-navigation-drawer v-model="drawer" temporary>
				<v-list>
					<v-list-item title="Navigation"></v-list-item>
					<v-list-item to="/" title="Index"></v-list-item>
					<v-list-item to="counter" title="counter"></v-list-item>
					<v-list-item to="register" title="Register"></v-list-item>
				</v-list>
			</v-navigation-drawer>

			<v-main class="ma-4">
				<NuxtPage />
			</v-main>
		</VApp>
	</div>
</template>

<script setup lang="ts">
import { useTheme } from "vuetify";

const theme = useTheme();

const drawer = ref(false);
</script>
