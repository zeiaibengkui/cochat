<template>
  <div>
    <VApp>
      <NavBar />
      <pre>pre: {{ data }}</pre>
    </VApp>
  </div>
</template>

<script setup lang="ts">
import NavBar from './layouts/NavBar.vue';

const { data } = useFetch("/api/hello")
</script>