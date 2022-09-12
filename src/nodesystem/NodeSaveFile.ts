import type { ConfigType } from './Config';
import type { NodeSaveData } from './NodeSaveData';

export type NodeSaveFile = {
	nodes: NodeSaveData[];
	connections: {
		from: {
			nodeId: string;
			index: number;
		};
		to: {
			nodeId: string;
			index: number;
		};
	}[];
	config?: ConfigType;
};
