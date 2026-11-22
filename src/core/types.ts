export type Format = 'original' | 'jpg' | 'png' | 'webp' | 'avif';

export type Space = {
	id: string;
	name: string;
	width?: number;
	height?: number;
	suffix: string;
	format: Format;
	level: number;
	originalOutput: boolean;
	outputDir: string;
	keepExif: boolean;
};

export type Row = {
	spaceId: string;
	filepath: string;
	status: 'processing' | 'completed' | 'failed';
	outputPath: string;
	fileSize: number;
	outSize: number;
	extname: string;
	targetExtname: string;
	token: number;
	error: string;
};

export type WindowBounds = {
	width: number;
	height: number;
};
