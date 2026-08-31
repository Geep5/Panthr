const SYSTEM = `You generate SVG artwork. Reply with ONLY SVG inner markup (paths, shapes, groups) that fits viewBox "0 0 120 120" — no <svg> wrapper, no code fences, no prose. Bold, flat-color, simple vector style. Center the subject and use most of the canvas.`;

/** Resolve the Anthropic API key: build-time env first, then localStorage. */
export function apiKey(): string {
	return (
		(import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ??
		localStorage.getItem('panthr-anthropic-key') ??
		''
	);
}

/** Generate SVG inner markup (viewBox 0 0 120 120) for a prompt with Fable 5. */
export async function generateSvg(prompt: string, key: string): Promise<string> {
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
			max_tokens: 4000,
			system: SYSTEM,
			messages: [{ role: 'user', content: prompt }]
		})
	});
	if (!res.ok) {
		throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
	}
	const json = await res.json();
	let text: string =
		json.content
			?.filter((b: { type: string }) => b.type === 'text')
			.map((b: { text: string }) => b.text)
			.join('') ?? '';
	text = text.replace(/```(?:svg|xml|html)?/g, '').trim();

	// unwrap a full <svg> document, rescaling its viewBox onto 0 0 120 120
	const wrapper = text.match(/<svg([^>]*)>([\s\S]*)<\/svg>/i);
	if (wrapper) {
		let inner = wrapper[2].trim();
		const vb = wrapper[1].match(/viewBox\s*=\s*["']\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.\-]+)/i);
		if (vb) {
			const [, x, y, w, h] = vb.map(Number);
			const s = 120 / Math.max(w || 120, h || 120);
			if (x || y || Math.abs(s - 1) > 0.001) {
				inner = `<g transform="scale(${s.toFixed(4)}) translate(${(-x).toFixed(2)}, ${(-y).toFixed(2)})">${inner}</g>`;
			}
		}
		text = inner;
	}

	if (!text) throw new Error('Model returned no SVG');
	return text;
}
