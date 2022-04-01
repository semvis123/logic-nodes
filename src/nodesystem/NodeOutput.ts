import type { NodeValueType } from "./NodeValueType";
import type { Node } from './Node';

export class NodeOutput {
    value: boolean | number | string = false;
    node: Node;
    constructor(public id: string,
        public name: string,
        public valueType: NodeValueType,
        public index
    ) {}
    setValue(value: string | number | boolean) {
        this.value = value;
        this.node.nodeConnectionHandler.updateValue(this);
    }
    setNode(node: Node) {
        this.node = node;
    }
}