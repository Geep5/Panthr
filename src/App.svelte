<script lang="ts">
	import {
		Background,
		Controls,
		MiniMap,
		Panel,
		SvelteFlow,
		SvelteFlowProvider,
		type Edge,
		type Node
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { reconnectEdge, type Connection, type FinalConnectionState, type HandleType } from '@xyflow/system';

	import Inspector from './lib/Inspector.svelte';
	import AiSvgNode from './lib/nodes/AiSvgNode.svelte';
	import PreviewNode from './lib/nodes/PreviewNode.svelte';
	import ReconnectableEdge from './lib/edges/ReconnectableEdge.svelte';
	import ColorNode from './lib/nodes/ColorNode.svelte';
	import DelayNode from './lib/nodes/DelayNode.svelte';
	import PositionNode from './lib/nodes/PositionNode.svelte';
	import ScaleNode from './lib/nodes/ScaleNode.svelte';
	import RotateNode from './lib/nodes/RotateNode.svelte';
	import SvgSourceNode from './lib/nodes/SvgSourceNode.svelte';
	import TextNode from './lib/nodes/TextNode.svelte';
	import TranslateNode from './lib/nodes/TranslateNode.svelte';

	const nodeTypes = {
		svgSource: SvgSourceNode,
		text: TextNode,
		ai: AiSvgNode,
		scale: ScaleNode,
		translate: TranslateNode,
		rotate: RotateNode,
		position: PositionNode,
		delay: DelayNode,
		color: ColorNode,
		preview: PreviewNode
	};
	const edgeTypes = { reconnectable: ReconnectableEdge };

	const STORAGE_KEY = 'panthr-flow-v1';
	const LEGACY_STORAGE_KEY = 'lottienode-flow-v1';

	const defaultNodes: Node[] = [
		{
			id: 'svg-1',
			type: 'svgSource',
			position: { x: 0, y: 60 },
			data: { shape: 'star', size: 120, fill: '#7c6cff', customMarkup: '' }
		},
		{
			id: 'scale-1',
			type: 'scale',
			position: { x: 300, y: 0 },
			data: { percent: 10, duration: 900 }
		},
		{
			id: 'move-1',
			type: 'translate',
			position: { x: 300, y: 200 },
			data: { amount: 60, unit: 'percent', duration: 1200 }
		},
		{ id: 'preview-1', type: 'preview', position: { x: 580, y: 60 }, data: { filter: 'all' } }
	];

	const defaultEdges: Edge[] = [
		{ id: 'e1', type: 'reconnectable', source: 'svg-1', target: 'scale-1', animated: true },
		{ id: 'e2', type: 'reconnectable', source: 'scale-1', target: 'move-1', animated: true },
		{ id: 'e3', type: 'reconnectable', source: 'move-1', target: 'preview-1', animated: true }
	];

	const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

	function loadSaved(): { nodes: Node[]; edges: Edge[]; nextId: number } | null {
		try {
			const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.edges)) return null;
			return {
				nodes: parsed.nodes,
				edges: parsed.edges,
				nextId: Number(parsed.nextId) || 1
			};
		} catch {
			return null;
		}
	}

	const saved = loadSaved();
	let nodes = $state.raw<Node[]>(saved?.nodes ?? clone(defaultNodes));
	let edges = $state.raw<Edge[]>(saved?.edges ?? clone(defaultEdges));
	let nextId = saved?.nextId ?? 1;

	// persist the board (debounced — drags retrigger this constantly)
	$effect(() => {
		const snapshot = JSON.stringify({ nodes, edges, nextId });
		const t = setTimeout(() => localStorage.setItem(STORAGE_KEY, snapshot), 250);
		return () => clearTimeout(t);
	});

	function resetBoard() {
		nodes = clone(defaultNodes);
		edges = clone(defaultEdges);
		nextId = 1;
	}
	function onReconnect(oldEdge: Edge, connection: Connection) {
		edges = reconnectEdge(oldEdge, connection, edges);
	}

	function onReconnectEnd(
		_event: MouseEvent | TouchEvent,
		edge: Edge,
		_handleType: HandleType,
		connectionState: FinalConnectionState
	) {
		// detach only when dropped on empty canvas, not back on a handle
		if (!connectionState.isValid && !connectionState.toNode) {
			edges = edges.filter((e) => e.id !== edge.id);
		}
	}

	function reaches(from: string, to: string): boolean {
		const stack = [from];
		const seen = new Set<string>();
		while (stack.length > 0) {
			const cur = stack.pop()!;
			if (cur === to) return true;
			if (seen.has(cur)) continue;
			seen.add(cur);
			for (const e of edges) if (e.source === cur) stack.push(e.target);
		}
		return false;
	}

	/**
	 * Graph-global rule: no cycles. Everything else (occupied handles,
	 * self-loops, same-pair no-ops) is enforced by the handles themselves.
	 */
	function isValidConnection(conn: Edge | Connection): boolean {
		if (!conn.source || !conn.target) return false;
		return !reaches(conn.target, conn.source);
	}

	const defaults: Record<string, Record<string, unknown>> = {
		svgSource: { shape: 'circle', size: 120, fill: '#7c6cff', customMarkup: '' },
		text: { text: 'Hello', fontSize: 36, fill: '#e6e8ee' },
		ai: { prompt: '', markup: '', size: 120, status: 'idle', error: '', progress: '' },
		scale: { percent: 10, duration: 1000 },
		translate: { amount: 100, unit: 'px', duration: 1000 },
		position: { x: 0, y: 0, unit: 'percent' },
		rotate: { degrees: 90, duration: 1000 },
		delay: { duration: 500 },
		color: { color: '#ff5470' },
		preview: { filter: 'all' }
	};

	function addNode(type: keyof typeof nodeTypes) {
		const id = `${type}-${nextId++}`;
		nodes = [
			...nodes,
			{
				id,
				type,
				position: { x: 80 + nextId * 24, y: 320 + (nextId % 5) * 40 },
				data: { ...defaults[type] }
			}
		];
	}
</script>

<div class="app">
	<SvelteFlowProvider>
		<div class="canvas">
			<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		{edgeTypes}
		defaultEdgeOptions={{ type: 'reconnectable', animated: true }}
		onreconnect={onReconnect}
		onreconnectend={onReconnectEnd}
		{isValidConnection}
		fitView
		colorMode="dark"
		deleteKey={['Backspace', 'Delete']}
	>
		<Background gap={20} />
		<Controls />
		<MiniMap pannable zoomable />
		<Panel position="top-left">
			<div class="toolbar">
				<strong class="brand"><img src="/logo.svg" alt="Panthr logo" class="brand-logo" /><span class="brand-name">Panthr</span></strong>
				<button onclick={() => addNode('svgSource')}>+ SVG</button>
				<button onclick={() => addNode('text')}>+ Text</button>
				<button onclick={() => addNode('ai')}>+ AI SVG</button>
				<button onclick={() => addNode('scale')}>+ Scale</button>
				<button onclick={() => addNode('translate')}>+ Move X</button>
				<button onclick={() => addNode('position')}>+ Position</button>
				<button onclick={() => addNode('rotate')}>+ Rotate</button>
				<button onclick={() => addNode('delay')}>+ Delay</button>
				<button onclick={() => addNode('color')}>+ Color</button>
				<button onclick={() => addNode('preview')}>+ Preview</button>
				<button class="reset" onclick={resetBoard}>Reset</button>
			</div>
		</Panel>
			</SvelteFlow>
		</div>
		<Inspector />
	</SvelteFlowProvider>
</div>
