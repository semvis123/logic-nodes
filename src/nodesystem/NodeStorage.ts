import type { Node } from "./Node";
import type { NodeConnectionHandler } from "./handlers/NodeConnectionHandler";

export class NodeStorage {
    nodes: Node[] = [];
    nodeConnectionHandler: NodeConnectionHandler;
}