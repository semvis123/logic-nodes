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

export const nodeClasses = [
	ToggleNode,
	AndNode,
	ClockNode,
	CounterNode,
	OrNode,
	NotNode,
	DisplayNode,
	DelayNode,
	HtmlOverlayNode,
	ButtonNode
];

export const nodeClassesMap = {};

nodeClasses.forEach((nodeClass) => {
	nodeClassesMap[nodeClass.name] = nodeClass;
});
