import type { NodeParameter } from './nodeDetailBox/NodeDetailBox';

export type NodeSaveData = {
	id: string;
	type?: string;
	x: number;
	y: number;
	parameters: NodeParameter[];
};
