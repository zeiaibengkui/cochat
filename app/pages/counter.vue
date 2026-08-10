<template>
	<pre>pre: {{ data }}</pre>
	<hr />
	<v-btn @click="mainStore.increment()"
		>counter++ (now:{{ mainStore.counter }})
	</v-btn>
</template>

<script setup lang="ts">
import { useChatStore } from "~/store/chat";
const mainStore = useChatStore();
const { data } = useFetch("/api/hello");
</script>
