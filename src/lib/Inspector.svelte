<script lang="ts">
	import { useNodes, useSvelteFlow } from '@xyflow/svelte';
	import { apiKey, generateSvg } from './flow/ai';
	import type { AiData, PositionData, PreviewData, SvgSourceData } from './flow/evaluate';

	const nodes = useNodes();
	const { updateNodeData } = useSvelteFlow();

	let sel = $derived(nodes.current.find((n) => n.selected));
	let d = $derived((sel?.data ?? {}) as Record<string, unknown>);

	const LABELS: Record<string, string> = {
		svgSource: 'SVG Source',
		text: 'Text',
		ai: 'AI SVG',
		scale: 'Scale',
		translate: 'Move X',
		rotate: 'Rotate',
		delay: 'Delay',
		color: 'Color',
		position: 'Position',
		preview: 'Preview'
	};

	const SHAPES = ['rect', 'circle', 'triangle', 'star', 'heart', 'custom'] as const;

	function set(patch: Record<string, unknown>) {
		if (sel) updateNodeData(sel.id, patch);
	}

	const numOf = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
	const valOf = (e: Event) =>
		(e.currentTarget as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

	// --- position pad ---

	let pad = $state<HTMLDivElement>();
	let dragging = $state(false);

	const clampPct = (v: number) => Math.max(-50, Math.min(50, Math.round(v)));

	function padPointer(e: PointerEvent) {
		const el = pad;
		if (!el) return;
		const r = el.getBoundingClientRect();
		set({
			x: clampPct(((e.clientX - r.left) / r.width - 0.5) * 100),
			y: clampPct(((e.clientY - r.top) / r.height - 0.5) * 100),
			unit: 'percent'
		});
	}

	// --- ai generation ---

	let keyPresent = $state(!!apiKey());
	let keyDraft = $state('');

	function saveKey() {
		localStorage.setItem('panthr-anthropic-key', keyDraft.trim());
		keyDraft = '';
		keyPresent = !!apiKey();
	}

	async function generate() {
		if (!sel) return;
		const nodeId = sel.id;
		const key = apiKey();
		if (!key) {
			updateNodeData(nodeId, { status: 'error', error: 'Add an Anthropic API key first' });
			return;
		}
		const prompt = String(d.prompt ?? '').trim();
		if (!prompt) return;
		updateNodeData(nodeId, { status: 'loading', error: '' });
		try {
			const markup = await generateSvg(prompt, key);
			updateNodeData(nodeId, { markup, status: 'idle', error: '' });
		} catch (err) {
			updateNodeData(nodeId, { status: 'error', error: String(err).slice(0, 300) });
		}
	}
</script>

{#if sel}
	<aside class="inspector">
		<div class="inspector-title">{LABELS[sel.type ?? ''] ?? sel.type}</div>
		<div class="inspector-id">{sel.id}</div>

		{#if sel.type === 'svgSource'}
			<label class="field">
				<span>Shape</span>
				<select class="nodrag" value={d.shape} onchange={(e) => set({ shape: valOf(e) })}>
					{#each SHAPES as s (s)}
						<option value={s}>{s}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span>Size</span>
				<input type="number" min="8" step="4" value={d.size} oninput={(e) => set({ size: numOf(e) })} />
			</label>
			<label class="field">
				<span>Fill</span>
				<input type="color" value={d.fill} oninput={(e) => set({ fill: valOf(e) })} />
			</label>
			{#if (d as SvgSourceData).shape === 'custom'}
				<textarea
					class="custom-markup"
					rows="6"
					spellcheck="false"
					placeholder="<path d=&quot;...&quot; fill=&quot;#fff&quot;/>"
					value={d.customMarkup as string}
					oninput={(e) => set({ customMarkup: valOf(e) })}
				></textarea>
			{/if}
		{:else if sel.type === 'text'}
			<label class="field">
				<span>Text</span>
				<input class="wide" type="text" value={d.text} oninput={(e) => set({ text: valOf(e) })} />
			</label>
			<label class="field">
				<span>Size</span>
				<input type="number" min="8" step="2" value={d.fontSize} oninput={(e) => set({ fontSize: numOf(e) })} />
			</label>
			<label class="field">
				<span>Fill</span>
				<input type="color" value={d.fill} oninput={(e) => set({ fill: valOf(e) })} />
			</label>
		{:else if sel.type === 'ai'}
			<textarea
				class="custom-markup"
				rows="3"
				placeholder="describe it — e.g. a horse"
				value={d.prompt as string}
				oninput={(e) => set({ prompt: valOf(e) })}
			></textarea>
			<button class="action" disabled={(d as AiData).status === 'loading'} onclick={generate}>
				{(d as AiData).status === 'loading' ? 'Generating…' : 'Generate'}
			</button>
			<label class="field">
				<span>Size</span>
				<input type="number" min="8" step="4" value={d.size} oninput={(e) => set({ size: numOf(e) })} />
			</label>
			{#if (d as AiData).status === 'error'}
				<div class="inspector-error">{(d as AiData).error}</div>
			{/if}
			{#if !keyPresent}
				<div class="inspector-hint">No Anthropic API key configured.</div>
				<input
					class="wide"
					type="password"
					placeholder="sk-ant-..."
					bind:value={keyDraft}
				/>
				<button class="action" disabled={!keyDraft.trim()} onclick={saveKey}>Save key</button>
			{/if}
		{:else if sel.type === 'scale'}
			<label class="field">
				<span>Grow %</span>
				<input type="number" step="1" value={d.percent} oninput={(e) => set({ percent: numOf(e) })} />
			</label>
			<label class="field">
				<span>Duration ms</span>
				<input type="number" min="50" step="100" value={d.duration} oninput={(e) => set({ duration: numOf(e) })} />
			</label>
		{:else if sel.type === 'translate'}
			<label class="field">
				<span>Amount</span>
				<input type="number" step="1" value={d.amount} oninput={(e) => set({ amount: numOf(e) })} />
			</label>
			<label class="field">
				<span>Unit</span>
				<select value={d.unit} onchange={(e) => set({ unit: valOf(e) })}>
					<option value="px">px</option>
					<option value="percent">% of screen</option>
				</select>
			</label>
			<label class="field">
				<span>Duration ms</span>
				<input type="number" min="50" step="100" value={d.duration} oninput={(e) => set({ duration: numOf(e) })} />
			</label>
		{:else if sel.type === 'rotate'}
			<label class="field">
				<span>Degrees</span>
				<input type="number" step="15" value={d.degrees} oninput={(e) => set({ degrees: numOf(e) })} />
			</label>
			<label class="field">
				<span>Duration ms</span>
				<input type="number" min="50" step="100" value={d.duration} oninput={(e) => set({ duration: numOf(e) })} />
			</label>
		{:else if sel.type === 'delay'}
			<label class="field">
				<span>Duration ms</span>
				<input type="number" min="50" step="100" value={d.duration} oninput={(e) => set({ duration: numOf(e) })} />
			</label>
		{:else if sel.type === 'color'}
			<label class="field">
				<span>Color</span>
				<input type="color" value={d.color} oninput={(e) => set({ color: valOf(e) })} />
			</label>
			<div class="inspector-hint">Recolors every shape passing through this node.</div>
		{:else if sel.type === 'position'}
			<div
				class="pad"
				bind:this={pad}
				role="presentation"
				onpointerdown={(e) => {
					dragging = true;
					e.currentTarget.setPointerCapture(e.pointerId);
					padPointer(e);
				}}
				onpointermove={(e) => {
					if (dragging) padPointer(e);
				}}
				onpointerup={() => (dragging = false)}
			>
				<div
					class="pad-dot"
					style:left="{50 + ((d as PositionData).unit === 'percent' ? Number(d.x) || 0 : 0)}%"
					style:top="{50 + ((d as PositionData).unit === 'percent' ? Number(d.y) || 0 : 0)}%"
				></div>
			</div>
			<label class="field">
				<span>X</span>
				<input type="number" step="1" value={d.x} oninput={(e) => set({ x: numOf(e) })} />
			</label>
			<label class="field">
				<span>Y</span>
				<input type="number" step="1" value={d.y} oninput={(e) => set({ y: numOf(e) })} />
			</label>
			<label class="field">
				<span>Unit</span>
				<select value={d.unit} onchange={(e) => set({ unit: valOf(e) })}>
					<option value="percent">% of stage</option>
					<option value="px">px</option>
				</select>
			</label>
		{:else if sel.type === 'preview'}
			<div class="inspector-hint">Playback, scrubbing, and the shape filter live on the node itself.</div>
			<label class="field">
				<span>Show</span>
				<input class="wide" type="text" readonly value={(d as PreviewData).filter} />
			</label>
		{/if}
	</aside>
{/if}
