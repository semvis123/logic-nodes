export class Config {
	theme = {
		backgroundColor: '#1D1E20',
		nodeBackfroundColor: '#161618',
		nodeBorderColor: '#FFF',
		nodeTextColor: '#FFF',
		connectionColor: '#FFF',
		nodeSelectedColor: 'rgba(0, 30, 120, 0.5)',
		nodeSelectionSquareColor: 'rgba(0, 0, 0, 0.2)',
		connectionPointRadius: 3,
		nodeBorderRadius: 3
	};
	renderMode = 'variable';
	hardwareAccelerationHtmlOverlay = true;

	setConfig(config: object) {
		for (const key in config) {
			this[key] = config[key];
		}
	}

	getConfig() {
		return this;
	}

	setValue(key: string, value: string | number | boolean) {
		this[key] = value;
	}
}
