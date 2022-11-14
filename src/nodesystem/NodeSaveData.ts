import type { NodeParameter } from './fullscreenPrompt/FullscreenPrompt';

export type NodeSaveData = {
	layer: number;
	id: string;
	type?: string;
	x: number;
	y: number;
	parameters: NodeParameter[];
};
