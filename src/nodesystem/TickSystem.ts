import type { NodeConnectionHandler } from './handlers/NodeConnectionHandler';

export type TickTimeoutReference = { ticks: number; currentTicks: number; interval: boolean; callback: () => void };

export class TickSystem {
	tickTimer: NodeJS.Timer;
	tickSpeed = 50; //ms
	waitingQueue: TickTimeoutReference[] = [];

	constructor(private connectionHandler: NodeConnectionHandler) {}

	start() {
		this.tickTimer = setInterval(this.tick.bind(this), this.tickSpeed);
	}

	stop() {
		this.tickTimer && clearInterval(this.tickTimer);
	}

	tick() {
		this.waitingQueue.forEach((x) => {
			x.currentTicks++;
			if (x.currentTicks >= x.ticks) {
				x.callback();
				if (x.interval) {
					x.currentTicks = 0;
				}
			}
		});
		this.waitingQueue = this.waitingQueue.filter((x) => x.ticks > x.currentTicks);
		this.connectionHandler && this.connectionHandler.updateAllValues();
	}

	waitTicks(callback: () => void, ticks: number, interval = false) {
		const ref = { ticks, callback, interval, currentTicks: 0 };
		this.waitingQueue.push(ref);
		return ref;
	}

	removeTickTimeout(reference: TickTimeoutReference) {
		this.waitingQueue = this.waitingQueue.filter((x) => x != reference);
	}
}
