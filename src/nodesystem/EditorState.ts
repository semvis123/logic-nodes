import type { ContextMenu } from './ContextMenu';
import type { NodeOutput } from './NodeOutput';
import type { Node } from './Node';

export class EditorState {
    view = {
        x: 0,
        y: 0,
        zoom: 1,
    };
    layer = 0;
    selectedNodes: Node[];
    selectionBox: { x: number; y: number; width: number; height: number } | undefined;
    contextMenu: ContextMenu;
    halfConnection: {
        output: NodeOutput;
        outputPos: {
            x: number;
            y: number;
        };
        mousePos: {
            x: number;
            y: number;
        };
    };
}