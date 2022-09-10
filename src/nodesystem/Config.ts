export type ThemeConfig = {
	backgroundColor: string;
	nodeBackfroundColor: string;
	nodeBorderColor: string;
	nodeTextColor: string;
	connectionColor: string;
	nodeSelectedColor: string;
	nodeSelectionSquareColor: string;
	connectionPointRadius: number;
	nodeBorderRadius: number;
	nodeHighColor: string;
	nodeLowColor: string;
};

export type ConfigType = {
	theme: ThemeConfig;
	renderMode: 'variable';
	hardwareAccelerationHtmlOverlay: boolean;
	colorConnectionLines: boolean;
	nodeSpacing: number;
	nodesCanOverlap: boolean;
};

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
		nodeBorderRadius: 3,
		nodeHighColor: '#372',
		nodeLowColor: '#f23'
	};
	renderMode = 'variable';
	hardwareAccelerationHtmlOverlay = true;
	colorConnectionLines = true;
	nodeSpacing = 5;
	nodesCanOverlap = false;

	setConfig(config: object) {
		for (const key in config) {
			if (typeof this[key] == 'object') {
				for (const nestedKey in config[key]) {
					this[key][nestedKey] = config[key][nestedKey];
				}
			} else {
				this[key] = config[key];
			}
		}
	}

	getConfig() {
		return this;
	}

	toObject(): ConfigType {
		const config: unknown = {};
		for (const key in this) {
			if (typeof this[key] !== 'function') {
				config[key] = this[key];
			}
		}
		return config as ConfigType;
	}

	setValue(key: string, value: string | number | boolean) {
		this[key] = value;
	}
}
