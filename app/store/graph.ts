import cytoscape from "cytoscape";
import { defineStore } from "pinia";
import type { graphNode, GraphSelect } from "~~/server/db/schema/graph";
import type { GraphTree } from "~/composables/useGraphNav";

// cyInstance kept outside Pinia state to avoid reactivity issues
let cyInstance: cytoscape.Core | null = null;

export const useGraphStore = defineStore("graph", {
    state: () => ({
        graphs: [] as GraphSelect[],
        tree: null as GraphTree | null,
    }),
    getters: {
        graphId(): number | null {
            const raw = useRoute().query.graph;
            return raw ? Number(raw) : null;
        },
        focusedNodeId(): number | null {
            const raw = useRoute().query.node;
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
                const path = this.allPaths[pi]!;
                const idx = path.indexOf(focused);
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
            useRouter().replace({ query: { ...useRoute().query, node: id } });
        },
        setGraph(id: number) {
            useRouter().replace({ query: { ...useRoute().query, graph: id } });
        },
        setGraphAndFocused(graphId: number, nodeId: number) {
            useRouter().replace({ query: { graph: graphId, node: nodeId } });
        },
        async refreshTree() {
            await this.loadTree();
        },

        // --- Cytoscape ---
        initCy(container: HTMLElement) {
            cyInstance?.destroy();
            if (!this.tree) return;
            cyInstance = cytoscape({
                container,
                elements: [
                    ...this.tree.nodes.map((n) => ({
                        data: {
                            id: String(n.id),
                            label:
                                (n.property?.deleted ? "🗑 " : "") +
                                (n.property?.text?.slice(0, 25) ?? "#" + n.id),
                            role: n.property?.role ?? "user",
                            deleted: n.property?.deleted ? "true" : "false",
                        },
                    })),
                    ...this.tree.edges.map((e) => ({
                        data: {
                            id: e.source + "->" + e.target,
                            source: String(e.source),
                            target: String(e.target),
                        },
                    })),
                ],
                style: [
                    {
                        selector: "node",
                        style: {
                            label: "data(label)",
                            "font-size": "10px",
                            "background-color": "#1976D2",
                            color: "#fff",
                            "text-valign": "center",
                            "text-halign": "center",
                            "text-wrap": "wrap",
                            "text-max-width": "100px",
                            width: 36,
                            height: 36,
                        },
                    },
                    {
                        selector: "node[role='assistant']",
                        style: { "background-color": "#2E7D32" },
                    },
                    {
                        selector: "node[deleted='true']",
                        style: { "background-color": "#616161", "text-opacity": 0.5 },
                    },
                    {
                        selector: "edge",
                        style: {
                            "line-color": "#666",
                            "target-arrow-color": "#666",
                            "target-arrow-shape": "triangle",
                            "curve-style": "bezier",
                            width: 2,
                        },
                    },
                ],
                layout: { name: "breadthfirst", directed: true, spacingFactor: 1.2 },
            });
            cyInstance.on("tap", "node", (evt) => this.setFocused(Number(evt.target.id())));
        },
        applyVisibility(showAll = false) {
            if (!cyInstance) return;
            if (showAll) {
                cyInstance.elements().style("opacity", 1).style("display", "element");
                return;
            }
            const pathSet = new Set(this.currentPath);
            const dimmedSet = new Set<number>();
            for (const pid of pathSet) {
                cyInstance
                    .getElementById(String(pid))
                    .outgoers("node")
                    .forEach((k) => {
                        const kidId = Number(k.id());
                        if (!pathSet.has(kidId)) dimmedSet.add(kidId);
                    });
            }
            cyInstance.nodes().forEach((n) => {
                const nid = Number(n.id());
                if (pathSet.has(nid)) n.style("opacity", 1).style("display", "element");
                else if (dimmedSet.has(nid)) n.style("opacity", 0.4).style("display", "element");
                else n.style("display", "none");
            });
            cyInstance.edges().forEach((e) => {
                const src = Number(e.source().id()),
                    tgt = Number(e.target().id());
                if (pathSet.has(src) || dimmedSet.has(src)) {
                    const visible = pathSet.has(tgt) || dimmedSet.has(tgt);
                    e.style("display", visible ? "element" : "none").style(
                        "opacity",
                        dimmedSet.has(src) || dimmedSet.has(tgt) ? 0.4 : 1,
                    );
                } else e.style("display", "none");
            });
        },
        highlightFocused() {
            if (!cyInstance) return;
            cyInstance.elements().removeClass("focused");
            const id = this.focusedNodeId;
            if (id) cyInstance.getElementById(String(id)).addClass("focused");
        },
    },
});
