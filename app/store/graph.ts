import { defineStore } from "pinia";
import type { graphNode, GraphSelect } from "~~/server/db/schema/graph";
import type { GraphTree } from "~/composables/useGraphNav";

export const useGraphStore = defineStore("graph", {
    state: () => ({
        graphs: [] as GraphSelect[],
        tree: null as GraphTree | null,
    }),
    getters: {
        graphId(): number | null {
            const route = useRoute();
            const raw = route.query.graph;
            return raw ? Number(raw) : null;
        },
        focusedNodeId(): number | null {
            const route = useRoute();
            const raw = route.query.node;
            return raw ? Number(raw) : null;
        },
        allPaths(): number[][] {
            if (!this.tree) return [];
            const { nodes, edges } = this.tree;
            const childrenMap = new Map<number, number[]>();
            const parentMap = new Map<number, number | null>();
            for (const n of nodes) {
                childrenMap.set(n.id, []);
                parentMap.set(n.id, n.parent);
            }
            for (const e of edges) childrenMap.get(e.source)?.push(e.target);
            const root = nodes.find((n) => n.parent == null || !parentMap.has(n.parent));
            if (!root) return [];
            const paths: number[][] = [];
            function dfs(nodeId: number, path: number[]) {
                const kids = childrenMap.get(nodeId) ?? [];
                if (kids.length === 0) {
                    paths.push([...path]);
                    return;
                }
                for (const c of kids) dfs(c, [...path, c]);
            }
            dfs(root.id, [root.id]);
            return paths;
        },
        currentPathMeta(): { pathIndex: number; depth: number } | null {
            const focused = this.focusedNodeId;
            if (!focused || !this.allPaths.length) return null;
            for (let pi = 0; pi < this.allPaths.length; pi++) {
                const idx = this.allPaths[pi].indexOf(focused);
                if (idx !== -1) return { pathIndex: pi, depth: idx };
            }
            return null;
        },
        currentPath(): number[] {
            const meta = this.currentPathMeta;
            if (!meta) return [];
            return this.allPaths[meta.pathIndex] ?? [];
        },
        pathMsgs(): graphNode[] {
            const path = this.currentPath;
            if (path.length <= 1) return [];
            return path
                .slice(1)
                .map((id) => this.tree?.nodes.find((n) => n.id === id))
                .filter(Boolean) as graphNode[];
        },
    },
    actions: {
        async loadGraphs() {
            try {
                this.graphs = await $fetch<GraphSelect[]>("/api/getGraphs");
            } catch {
                /* */
            }
        },
        async loadTree() {
            const id = this.graphId;
            if (!id) {
                this.tree = null;
                return;
            }
            try {
                this.tree = await $fetch(`/api/graphTree?id=${id}`);
                // Fallback: if focused node not in tree, reset to root
                if (this.tree && this.focusedNodeId) {
                    const inTree = this.tree.nodes.some((n) => n.id === this.focusedNodeId);
                    if (!inTree) {
                        const root = this.tree.nodes.find((n) => n.parent == null);
                        if (root) this.setFocused(root.id);
                    }
                }
            } catch {
                this.tree = null;
            }
        },
        setFocused(id: number) {
            const router = useRouter();
            const route = useRoute();
            router.replace({ query: { ...route.query, node: id } });
        },
        setGraph(id: number) {
            const router = useRouter();
            const route = useRoute();
            router.replace({ query: { ...route.query, graph: id } });
        },
        setGraphAndFocused(graphId: number, nodeId: number) {
            useRouter().replace({ query: { graph: graphId, node: nodeId } });
        },
        async refreshTree() {
            await this.loadTree();
        },
    },
});
