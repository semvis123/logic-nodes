import type { ConfigType } from './Config';
import type { NodeParameter } from './fullscreenPrompt/FullscreenPrompt';

export interface NodeSaveFile {
	nodes: {
		id: string;
		type: string;
		x: number;
		y: number;
		parameters: NodeParameter[];
	}[];
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
}
