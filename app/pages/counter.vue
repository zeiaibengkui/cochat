<template>
	<pre>pre: {{ data }}</pre>
	<hr />
	<v-btn @click="mainStore.increment()"
		>counter++ (now:{{ mainStore.counter }})
	</v-btn>
</template>

<script setup lang="ts">
import { useMainStore } from "@/store/index";
const mainStore = useMainStore();
const { data } = useFetch("/api/hello");
</script>
