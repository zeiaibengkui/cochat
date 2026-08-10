<script lang="ts" setup>
const msg = ref("msg");
const options = toRef({ name: "", email: "" });
async function submit(e: SubmitEvent) {
  e.preventDefault();
  msg.value = await $fetch("/api/addUser", {
    body: options.value,
    method: "post",
  });
}
</script>

<template>
  <VForm @submit="submit">
    <VTextField v-model="options.name" label="Name" />
    <VTextField v-model="options.email" label="Email" />
    <VBtn type="submit">Register</VBtn>
  </VForm>
  msg:<VCode>{{ msg }}</VCode>
</template>

<style lang="scss" scoped></style>
