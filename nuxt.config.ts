// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	modules: ["vuetify-nuxt-module", "@pinia/nuxt"],
	vuetify: {
		moduleOptions: {},
		vuetifyOptions: {
			theme: {
				transition: { origin: "100% 0%" },
				defaultTheme: "dark",
			},
		},
	},
});
