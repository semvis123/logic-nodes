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
import { CombinationNode } from './CombinationNode';

export const nodeClasses = [
	ToggleNode,
	AndNode,
	NorNode,
	OrNode,
	XorNode,
	NandNode,
	InputNode,
	OutputNode,
	CombinationNode,
	NotNode,
	ClockNode,
	CounterNode,
	DisplayNode,
	DelayNode,
	HtmlOverlayNode,
	ButtonNode,
	LabelNode
];

export const nodeClassesMap = {};

nodeClasses.forEach((nodeClass) => {
	nodeClassesMap[nodeClass.prototype.getMetadata().nodeName] = nodeClass;
});
