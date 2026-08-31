const PLAN_SYSTEM = `You plan flat vector illustrations for a 120x120 viewBox. Reply with ONLY a JSON array — no prose, no code fences. List the parts needed to draw the subject, in paint order (furthest back first: e.g. far-side legs before body, body before head, eyes last). 6 to 12 parts. Each item: {"name": "short part name", "desc": "one sentence: its shape, flat color, and position/coordinates within the 0-120 canvas"}. Plan coordinates so the parts connect into one coherent figure that fills most of the canvas.`;

const PART_SYSTEM = `You are one agent in a relay of agents, each drawing exactly ONE part of a flat vector illustration inside viewBox "0 0 120 120". Previous agents drew the SVG you are given; agents after you will draw the remaining parts. You are given the subject, the full part plan, the SVG so far, and the single part YOU own. Reply with ONLY the SVG elements for your part (path/polygon/ellipse etc., flat colors) — no <svg> wrapper, no code fences, no prose, no other parts. Match the positions and palette of what is already drawn so the figure stays coherent for the next agent.`;

/** Resolve the Anthropic API key: build-time env first, then localStorage. */
export function apiKey(): string {
	return (
		(import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ??
		localStorage.getItem('panthr-anthropic-key') ??
		''
	);
}

async function fable(system: string, user: string, key: string, maxTokens: number): Promise<string> {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': key,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model: 'claude-fable-5',
			max_tokens: maxTokens,
			system,
			messages: [{ role: 'user', content: user }]
		})
	});
	if (!res.ok) {
		throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
	}
	const json = await res.json();
	return (
		json.content
			?.filter((b: { type: string }) => b.type === 'text')
			.map((b: { text: string }) => b.text)
			.join('') ?? ''
	);
}

const stripFences = (t: string) => t.replace(/```(?:svg|xml|html|json)?/g, '').trim();

/** Unwrap a full <svg> document, rescaling its viewBox onto 0 0 120 120. */
function unwrapSvg(text: string): string {
	const wrapper = text.match(/<svg([^>]*)>([\s\S]*)<\/svg>/i);
	if (!wrapper) return text;
	let inner = wrapper[2].trim();
	const vb = wrapper[1].match(
		/viewBox\s*=\s*["']\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)/i
	);
	if (vb) {
		const [, x, y, w, h] = vb.map(Number);
		const s = 120 / Math.max(w || 120, h || 120);
		if (x || y || Math.abs(s - 1) > 0.001) {
			inner = `<g transform="scale(${s.toFixed(4)}) translate(${(-x).toFixed(2)}, ${(-y).toFixed(2)})">${inner}</g>`;
		}
	}
	return inner;
}

interface PlanPart {
	name: string;
	desc: string;
}

function parsePlan(text: string): PlanPart[] {
	const t = stripFences(text);
	const m = t.match(/\[[\s\S]*\]/);
	const raw: unknown = JSON.parse(m ? m[0] : t);
	const arr =
		Array.isArray(raw) ? raw
		: raw && typeof raw === 'object' && 'parts' in raw && Array.isArray(raw.parts) ? raw.parts
		: null;
	if (!arr || arr.length === 0) throw new Error('no parts');
	return arr.slice(0, 16).map((p: unknown): PlanPart => {
		const obj: object = p && typeof p === 'object' ? p : {};
		const name = 'name' in obj && typeof obj.name === 'string' ? obj.name : 'part';
		const desc =
			'desc' in obj && typeof obj.desc === 'string' ? obj.desc
			: 'description' in obj && typeof obj.description === 'string' ? obj.description
			: '';
		return { name, desc };
	});
}

/**
 * Two-stage generation: a planner splits the subject into parts in paint
 * order, then a builder draws one part per call, always seeing the SVG so
 * far, so each piece connects to the figure instead of one-shotting it.
 */
export async function generateSvg(
	prompt: string,
	key: string,
	onProgress?: (msg: string) => void
): Promise<string> {
	onProgress?.('planning parts…');
	let parts: PlanPart[];
	try {
		parts = parsePlan(await fable(PLAN_SYSTEM, prompt, key, 1500));
	} catch {
		parts = [{ name: 'whole drawing', desc: prompt }];
	}

	const planList = parts.map((q, j) => `${j + 1}. ${q.name} — ${q.desc}`).join('\n');
	let markup = '';

	for (const [i, p] of parts.entries()) {
		onProgress?.(`drawing ${p.name} (${i + 1}/${parts.length})…`);
		const user = `Subject: ${prompt}

Part plan:
${planList}

SVG so far (inside <svg viewBox="0 0 120 120">):
${markup || '(empty — you are drawing the first part)'}

Draw ONLY part ${i + 1}: ${p.name} — ${p.desc}`;
		const piece = unwrapSvg(stripFences(await fable(PART_SYSTEM, user, key, 3000)));
		if (piece) markup += `<g data-part="${p.name.replace(/[^\w -]/g, '')}">${piece}</g>`;
	}

	if (!markup) throw new Error('Model returned no SVG');
	return markup;
}
