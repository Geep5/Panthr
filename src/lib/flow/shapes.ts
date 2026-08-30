import type { SvgSourceData } from './evaluate';

const esc = (v: string) => v.replace(/[<>&"']/g, '');

export function markupFor(d: SvgSourceData): string {
	const s = Math.max(8, Number(d.size) || 120);
	const fill = esc(d.fill || '#7c6cff');
	const c = s / 2;

	switch (d.shape) {
		case 'rect':
			return `<rect x="0" y="0" width="${s}" height="${s}" rx="${s * 0.08}" fill="${fill}"/>`;
		case 'circle':
			return `<circle cx="${c}" cy="${c}" r="${c}" fill="${fill}"/>`;
		case 'triangle':
			return `<polygon points="${c},0 ${s},${s} 0,${s}" fill="${fill}"/>`;
		case 'star': {
			const pts: string[] = [];
			for (let i = 0; i < 10; i++) {
				const r = i % 2 === 0 ? c : c * 0.45;
				const a = -Math.PI / 2 + (i * Math.PI) / 5;
				pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`);
			}
			return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
		}
		case 'heart':
			return `<path d="M ${c} ${s * 0.88} C ${s * 0.08} ${s * 0.58} ${s * 0.02} ${s * 0.3} ${s * 0.25} ${s * 0.14} C ${s * 0.4} ${s * 0.06} ${c} ${s * 0.2} ${c} ${s * 0.3} C ${c} ${s * 0.2} ${s * 0.6} ${s * 0.06} ${s * 0.75} ${s * 0.14} C ${s * 0.98} ${s * 0.3} ${s * 0.92} ${s * 0.58} ${c} ${s * 0.88} Z" fill="${fill}"/>`;
		case 'custom':
			return d.customMarkup || '';
		default:
			return '';
	}
}

/** Svelte action: set SVG-namespaced innerHTML on a <g> wrapper. */
export function markup(node: SVGGElement, html: string) {
	node.innerHTML = html;
	return {
		update(next: string) {
			node.innerHTML = next;
		}
	};
}
