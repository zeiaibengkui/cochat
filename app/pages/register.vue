<!-- Redirect to combined login/register page -->
<script lang="ts" setup>
definePageMeta({ auth: { unauthenticatedOnly: true } });

await navigateTo("/login", { replace: true });
</script>
