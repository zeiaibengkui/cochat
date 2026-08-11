import { defineNuxtPlugin } from "#app";
import MarkdownRender, { enableKatex, enableMermaid } from "markstream-vue";
import "markstream-vue/index.css";
import "katex/dist/katex.min.css";

export default defineNuxtPlugin((nuxtApp) => {
    enableKatex();
    enableMermaid();
    nuxtApp.vueApp.component("MarkdownRender", MarkdownRender);
});
