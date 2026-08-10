import type { graphNode, GraphSelect } from "~~/server/db/schema/graph";

export interface GraphTree {
	nodes: graphNode[];
	edges: { source: number; target: number }[];
}

/** Shared graph navigation — driven by ?graph= and ?node= URL params */
export function useGraphNav() {
	const route = useRoute();
	const router = useRouter();

	// URL state
	const graphId = computed(() => {
		const raw = route.query.graph;
		return raw ? Number(raw) : null;
	});
	const focusedNodeId = computed(() => {
		const raw = route.query.node;
		return raw ? Number(raw) : null;
	});

	// Data
	const tree = ref<GraphTree | null>(null);
	const graphs = ref<GraphSelect[]>([]);

	// Load graph list
	const { data: graphList } = useFetch<GraphSelect[]>("/api/getGraphs");
	watchEffect(() => { graphs.value = graphList.value ?? []; });

	// Load tree when graphId changes
	async function loadTree() {
		const id = graphId.value;
		if (!id) { tree.value = null; return; }
		try {
			tree.value = await $fetch(`/api/graphTree?id=${id}`);
			// If focused node is not in this tree, fall back to root
			if (tree.value && focusedNodeId.value) {
				const inTree = tree.value.nodes.some(n => n.id === focusedNodeId.value);
				if (!inTree) {
					const root = tree.value.nodes.find(n => n.parent === null);
					if (root) router.replace({ query: { ...route.query, node: root.id } });
				}
			}
		} catch {
			tree.value = null;
		}
	}

	watch(graphId, loadTree, { immediate: true });

	// Build all root-to-leaf paths from the tree
	const allPaths = computed(() => {
		if (!tree.value) return [] as number[][];
		const { nodes, edges } = tree.value;
		const childrenMap = new Map<number, number[]>();
		const parentMap = new Map<number, number | null>();
		for (const n of nodes) {
			childrenMap.set(n.id, []);
			parentMap.set(n.id, n.parent);
		}
		for (const e of edges) {
			childrenMap.get(e.source)?.push(e.target);
		}

		// Find root (node with no parent in this graph)
		const root = nodes.find(n => n.parent === null || !parentMap.has(n.parent));
		if (!root) return [];

		// DFS to collect all root-to-leaf paths
		const paths: number[][] = [];
		function dfs(nodeId: number, path: number[]) {
			const children = childrenMap.get(nodeId) ?? [];
			if (children.length === 0) {
				paths.push([...path]);
				return;
			}
			for (const child of children) {
				dfs(child, [...path, child]);
			}
		}
		dfs(root.id, [root.id]);
		return paths;
	});

	// Find which path contains the focused node (and at what index)
	const currentPathMeta = computed(() => {
		const focused = focusedNodeId.value;
		if (!focused || !allPaths.value.length) return null;
		for (let pi = 0; pi < allPaths.value.length; pi++) {
			const idx = allPaths.value[pi].indexOf(focused);
			if (idx !== -1) return { pathIndex: pi, depth: idx };
		}
		return null;
	});

	const currentPath = computed(() => {
		const meta = currentPathMeta.value;
		if (!meta) return [] as number[];
		return allPaths.value[meta.pathIndex] ?? [];
	});

	// Navigation — always spread current query to avoid races
	function setFocused(id: number) {
		router.replace({ query: { ...route.query, node: id } });
	}

	function setGraph(id: number) {
		router.replace({ query: { ...route.query, graph: id } });
	}

	function setGraphAndFocused(graphId: number, nodeId: number) {
		router.replace({ query: { graph: graphId, node: nodeId } });
	}

	function goParent() {
		const meta = currentPathMeta.value;
		if (meta && meta.depth > 0) {
			setFocused(currentPath.value[meta.depth - 1]);
		}
	}

	function goChild() {
		const meta = currentPathMeta.value;
		if (meta && meta.depth < currentPath.value.length - 1) {
			setFocused(currentPath.value[meta.depth + 1]);
		}
	}

	function prevPath() {
		if (!allPaths.value.length) return;
		const meta = currentPathMeta.value;
		const newIdx = meta
			? (meta.pathIndex - 1 + allPaths.value.length) % allPaths.value.length
			: 0;
		// Keep same depth in the new path
		const depth = meta ? Math.min(meta.depth, allPaths.value[newIdx].length - 1) : 0;
		setFocused(allPaths.value[newIdx][depth]);
	}

	function nextPath() {
		if (!allPaths.value.length) return;
		const meta = currentPathMeta.value;
		const newIdx = meta
			? (meta.pathIndex + 1) % allPaths.value.length
			: 0;
		const depth = meta ? Math.min(meta.depth, allPaths.value[newIdx].length - 1) : 0;
		setFocused(allPaths.value[newIdx][depth]);
	}

	// Keyboard handler — attach to the page
	function handleKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement).tagName;
		if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

		switch (e.key) {
			case "PageUp":   e.preventDefault(); goParent(); break;
			case "PageDown": e.preventDefault(); goChild(); break;
			case "Home":     e.preventDefault(); prevPath(); break;
			case "End":      e.preventDefault(); nextPath(); break;
		}
	}

	onMounted(() => document.addEventListener("keydown", handleKeydown));
	onUnmounted(() => document.removeEventListener("keydown", handleKeydown));

	return {
		graphId,
		focusedNodeId,
		graphs,
		tree,
		allPaths,
		currentPath,
		currentPathMeta,
		setFocused,
		setGraph,
		setGraphAndFocused,
		refreshTree: loadTree,
		goParent,
		goChild,
		prevPath,
		nextPath,
	};
}
