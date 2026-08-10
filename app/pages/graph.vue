<script lang="ts" setup>
const graphs = useFetch("/api/getGraphs").data!;

const topic = ref("");

const selected = ref(0);

function addGraph(e: SubmitEvent) {
	e.preventDefault();
	$fetch("/api/modGraph", {
		method: "post",
		body: { topic: topic.value },
	});
}
</script>

<template>
	{{ graphs }}
	<hr />
	<VForm @submit="addGraph">
		<VTextField label="Topic" v-model="topic" />
		<VBtn type="submit">Add</VBtn></VForm
	>
	<br />
	<VSelect :items="graphs" v-model="selected" item-title="id"></VSelect>
	<hr />
	<node
		:id="graphs?.filter(a => a.id == selected)[0]?.root!"
		v-if="selected"></node>
</template>

<style lang="scss" scoped></style>
