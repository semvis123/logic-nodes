import { NodeOutput } from "../NodeOutput";
import { NodeType } from "../NodeType";
import { NodeValueType } from "../NodeValueType";
import { uuid } from "../utils";
import { Node } from "../Node";

export class HtmlOverlayNode extends Node {
    htmlElement: HTMLElement;

    constructor(id, x, y, nodeConnectionHandler) {
        super(id, NodeType.Input, x, y, 120, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeConnectionHandler);
    }
    renderNode(ctx) {
        super.renderNode(ctx)
        if (this.htmlElement) {
            this.htmlElement.style.left = this.x + 'px';
            this.htmlElement.style.top = this.y + 'px';
        } else {
            this.htmlElement = document.createElement('div');
            this.htmlElement.style.position = 'absolute';
            this.htmlElement.style.left = this.x + 'px';
            this.htmlElement.style.top = this.y + 'px';
            this.htmlElement.style.width = this.width + 'px';
            this.htmlElement.style.height = this.height + 'px';
            this.htmlElement.style.color = '#000';
            this.htmlElement.style.fontSize = '12px';
            this.htmlElement.style.fontFamily = 'Arial';
            this.htmlElement.style.textAlign = 'center';
            this.htmlElement.style.userSelect = 'none';
            this.htmlElement.style.pointerEvents = 'none';
            this.htmlElement.style.zIndex = '1';
            this.htmlElement.innerHTML = 'HtmlOverlay';
            document.body.appendChild(this.htmlElement);
        }
    }
}