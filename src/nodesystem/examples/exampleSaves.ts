import * as introduction from './introduction.json';
import * as segmentDisplay from './7-segment-display.json';
import * as RisingEdgeDetector from './rising-edge-detector.json';
import * as FallingEdgeDetector from './falling-edge-detector.json';
import * as calculator from './calculator.json';
import type { NodeSaveFile } from '../NodeSaveFile';

export const exampleSaves: { filename: string; save: NodeSaveFile }[] = [
	{ filename: 'Introduction', save: introduction as NodeSaveFile },
	{ filename: '7 Segment-display', save: segmentDisplay as NodeSaveFile },
	{ filename: 'Rising edge detector', save: RisingEdgeDetector as NodeSaveFile },
	{ filename: 'Falling edge detector', save: FallingEdgeDetector as NodeSaveFile },
	{ filename: 'Calculator', save: calculator as NodeSaveFile },
];
