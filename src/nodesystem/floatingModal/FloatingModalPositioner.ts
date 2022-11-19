import type { FloatingModal } from './FloatingModal';

export class FloatingModalPositioner {
	sharedInstance: FloatingModalPositioner;
	modals: FloatingModal[];

	private constructor() {
		this.modals = [];
	}

	getInstance(): FloatingModalPositioner {
		if (!this.sharedInstance) this.sharedInstance = new FloatingModalPositioner();
		return this.sharedInstance;
	}

	addModal(modal: FloatingModal) {
		this.modals.push(modal);
		this.positionModal(modal);
	}

	positionModal(modal: FloatingModal) {
		// move overlapping modals to the left.
		let overlappingModal = this.modals.find((m) => m !== modal && m.overlaps(modal));
		while (overlappingModal) {
			const x = overlappingModal.x - overlappingModal.htmlElement.getBoundingClientRect().width - 16;
			modal.setPosition(x, modal.y);
			overlappingModal = this.modals.find((m) => m !== modal && m.overlaps(modal));
		}
	}

	removeModal(modal: FloatingModal) {
		this.modals = this.modals.filter((m) => m !== modal);
	}

	bringToFront(modal: FloatingModal) {
		this.modals = this.modals.filter((m) => m !== modal);
		this.modals.push(modal);
		this.modals.forEach((m, i) => (m.htmlElement.style.zIndex = 100 + i.toString()));
	}

	closeAll() {
		this.modals.forEach((m) => m.remove());
	}
}
