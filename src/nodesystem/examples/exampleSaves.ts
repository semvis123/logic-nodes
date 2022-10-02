import * as welcome from './introduction.json';
import * as segmentDisplay from './7-segment-display.json';
import type { NodeSaveFile } from '../NodeSaveFile';

export const exampleSaves: { filename: string; save: NodeSaveFile }[] = [
	{ filename: 'Introduction', save: welcome as NodeSaveFile },
	{ filename: '7 Segment-display', save: segmentDisplay as NodeSaveFile }
];
