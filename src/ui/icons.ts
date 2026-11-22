const svg = (body: string, strokeWidth = 1.75) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const APP_ICONS = {
	logo: svg(
		'<path d="M3.9 3v10M10.9 3L6.4 8l4.5 5"/><circle cx="12.1" cy="8" r="1.05" fill="currentColor" stroke="none"/>',
		1.85
	),
	sun: svg(
		'<circle cx="8" cy="8" r="3"/><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"/>'
	),
	moon: svg('<path d="M13 9.7A5.2 5.2 0 0 1 6.3 3a5.3 5.3 0 1 0 6.7 6.7z"/>'),
	files: svg(
		'<path d="M4.5 2h5l3.5 3.5V13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V3.5A1.5 1.5 0 0 1 4.5 2z"/><path d="M9.5 2v3.5H13"/>'
	),
	folder: svg(
		'<path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.5h4.8A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z"/>'
	),
	play: svg('<path d="M4.5 3l8 5-8 5V3z"/>'),
	trash: svg(
		'<path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 8.5a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-8.5"/>'
	),
	upload: svg(
		'<path d="M8 10.5V3M5 5.5L8 2.5l3 3M2.5 10.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2"/>'
	),
	refresh: svg('<path d="M13.5 7.5a5.5 5.5 0 1 0-1.4 3.7"/><path d="M13.5 3.5v4h-4"/>'),
	more: svg('<path d="M3.5 8h.01M8 8h.01M12.5 8h.01"/>', 2.2),
	arrowRight: svg('<path d="M3.5 8h9M9 4.5L12.5 8 9 11.5"/>')
} as const;

export function emptyIllustrationSvg(dark: boolean): string {
	const ink = dark ? '#ededef' : '#18181b';
	const paper = dark ? '#18181a' : '#ffffff';
	const soft = dark ? '#222226' : '#f1f1ef';
	const shadow = dark ? '#2d2d34' : '#18181b';
	const ghost = dark ? '#3e3e46' : '#d0d0ca';

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 184 136" width="368" height="272" fill="none">
		<polygon points="36,86 88,110 142,83 90,59" fill="${shadow}"/>
		<polygon points="36,80 88,104 142,77 90,53" fill="${soft}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>
		<polygon points="36,68 88,92 142,65 90,41" fill="${paper}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>
		<polygon points="36,56 88,80 142,53 90,29" fill="${paper}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>
		<polygon points="53.5,54.7 89.9,71.5 125.6,53.7 89.2,36.9" fill="${soft}" stroke="${ghost}" stroke-width="1.1" stroke-linejoin="round"/>
		<polygon points="58.3,54.9 90.3,47.8 90.4,59.9 105.8,57.1 90.5,69.7" fill="${ink}"/>
		<circle cx="104.6" cy="49.2" r="2.8" fill="${ink}"/>
		<circle cx="146" cy="30" r="10.5" fill="${paper}" stroke="${ink}" stroke-width="1.4"/>
		<path d="M146 25.5v8.5M142.8 30.8L146 34l3.2-3.2" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		<path d="M22 36l1.4 3.6L27 41l-3.6 1.4L22 46l-1.4-3.6L17 41l3.6-1.4z" fill="${ghost}"/>
		<path d="M161 88l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9L157 92l2.9-1.1z" fill="${ghost}"/>
		<circle cx="28" cy="100" r="1.8" stroke="${ghost}" stroke-width="1.2"/>
		<circle cx="131" cy="18" r="1.5" fill="${ghost}"/>
	</svg>`;
}
