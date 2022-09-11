import type { NodeParameter } from './fullscreenPrompt/FullscreenPrompt';
import type { NodeSystem } from './NodeSystem';

export interface NodeConstructor {
	new (id: string, x: number, y: number, nodeSystem: NodeSystem, parameters?: NodeParameter[]);
}
