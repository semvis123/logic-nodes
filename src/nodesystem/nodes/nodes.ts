import { ToggleNode } from './ToggleNode';
import { AndNode } from './LogicAndNode';
import { ClockNode } from './ClockNode';
import { OrNode } from './LogicOrNode';
import { NotNode } from './LogicNotNode';
import { DisplayNode } from './DisplayNode';
import { DelayNode } from './DelayNode';
import { HtmlOverlayNode } from './HtmlOverlayNode';
import { CounterNode } from './CounterNode';
import { ButtonNode } from './ButtonNode';
import { XorNode } from './LogicXorNode';
import { NandNode } from './LogicNandNode';
import { NorNode } from './LogicNorNode';
import { LabelNode } from './LabelNode';
import { InputNode } from './InputNode';
import { OutputNode } from './OutputNode';
import { ToneNode } from './ToneNode';
import { ConnectionNode } from './ConnectionNode';
import { AudioInputNode } from './AudioInputNode';
import type { NodeConstructor } from '../NodeConstructor';

export const nodeClasses = [
	ToggleNode,
	AndNode,
	NorNode,
	OrNode,
	XorNode,
	NandNode,
	ConnectionNode,
	InputNode,
	OutputNode,
	NotNode,
	ClockNode,
	CounterNode,
	DisplayNode,
	DelayNode,
	HtmlOverlayNode,
	ButtonNode,
	LabelNode,
	ToneNode,
	AudioInputNode
];

export const nodeClassesMap = new Map<string, NodeConstructor>();

nodeClasses.forEach((nodeClass) => {
	nodeClassesMap.set(nodeClass.prototype.getMetadata().nodeName, nodeClass);
});
