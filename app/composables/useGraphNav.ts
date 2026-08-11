import type { graphNode } from "~~/server/db/schema/graph";
import { useGraphStore } from "~/store/graph";

export interface GraphTree {
    nodes: graphNode[];
    edges: { source: number; target: number }[];
}

/** Thin wrapper over useGraphStore + keyboard shortcuts */
export function useGraphNav() {
    const store = useGraphStore();

    // Keyboard handler
    function handleKeydown(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        const meta = store.currentPathMeta;
        const path = store.currentPath;
        if (!meta || !path.length) return;
        switch (e.key) {
            case "PageUp":
                e.preventDefault();
                if (meta.depth > 0) store.setFocused(path[meta.depth - 1]);
                break;
            case "PageDown":
                e.preventDefault();
                if (meta.depth < path.length - 1) store.setFocused(path[meta.depth + 1]);
                break;
            case "Home": {
                e.preventDefault();
                const paths = store.allPaths;
                if (!paths.length) return;
                const idx = (meta.pathIndex - 1 + paths.length) % paths.length;
                const d = Math.min(meta.depth, paths[idx].length - 1);
                store.setFocused(paths[idx][d]);
                break;
            }
            case "End": {
                e.preventDefault();
                const paths = store.allPaths;
                if (!paths.length) return;
                const idx = (meta.pathIndex + 1) % paths.length;
                const d = Math.min(meta.depth, paths[idx].length - 1);
                store.setFocused(paths[idx][d]);
                break;
            }
        }
    }

    onMounted(() => {
        store.loadGraphs();
        store.loadTree();
        document.addEventListener("keydown", handleKeydown);
    });
    onUnmounted(() => document.removeEventListener("keydown", handleKeydown));

    return {
        graphId: computed(() => store.graphId),
        focusedNodeId: computed(() => store.focusedNodeId),
        graphs: computed(() => store.graphs),
        tree: computed(() => store.tree),
        allPaths: computed(() => store.allPaths),
        currentPath: computed(() => store.currentPath),
        currentPathMeta: computed(() => store.currentPathMeta),
        setFocused: (id: number) => store.setFocused(id),
        setGraph: (id: number) => store.setGraph(id),
        setGraphAndFocused: (gid: number, nid: number) => store.setGraphAndFocused(gid, nid),
        refreshTree: () => store.refreshTree(),
    };
}
