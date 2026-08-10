<template>
	<VCard class="node">
		<!--https://vuetifyjs.com/en/components/cards/#basics-->
		<!-- <node ></node> -->
		Data:
		<pre>{{ mydata }}</pre>
		<br />
		<VCardActions>
			<v-btn @click="add" variant="tonal">Add</v-btn>
		</VCardActions>
		<br />
		Children:
		<pre>{{ children }}</pre>
		<node v-for="n in children" :key="n.id" :id="n.id" />
	</VCard>
</template>

<script lang="ts" setup>
import type { graphNode } from "~~/server/db/schema/graph";

const props = defineProps<{ id: number }>();

const { data: children, refresh } = await useFetch<graphNode[]>(
	"/api/children",
	{
		params: { parent: props.id },
	}
);

const mydata = await $fetch("/api/node", { params: { id: props.id } });

async function add() {
	await $fetch("/api/node", {
		method: "post",
		body: { parent: props.id, property: { text: "click to edit" } },
	});
	await refresh();
}
</script>

<style>
.node {
	width: auto;
	height: auto;
	border: blueviolet solid 2px;
	margin: 1rem;
	padding: 1rem;
}
</style>
