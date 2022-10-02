import type { NodeSystem } from "../NodeSystem";

export abstract class Command {
    constructor(public nodeSystem: NodeSystem){};
    abstract execute(): void;
}