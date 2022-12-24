export type ThemeConfig = {
	backgroundColor: string;
	nodeBackgroundColor: string;
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
	connectionRenderMode: 'bezier' | 'square';
};

export class Config {
	theme = {
		backgroundColor: '#1D1E20',
		nodeBackgroundColor: '#161618',
		nodeBorderColor: '#FFF',
		nodeTextColor: '#FFF',
		connectionColor: '#FFF',
		nodeSelectedColor: 'rgba(0, 30, 120, 0.5)',
		nodeSelectionSquareColor: 'rgba(0, 0, 0, 0.2)',
		connectionPointRadius: 3,
		nodeBorderRadius: 3,
		nodeHighColor: '#372',
		nodeLowColor: '#f23',
		nodeSelectionSquareBorderColor: 'rgba(94, 94, 94, 1)',
		gridThreshold: 1.25,
		gridSize: 45
	};
	renderMode = 'variable';
	hardwareAccelerationHtmlOverlay = true;
	colorConnectionLines = true;
	nodeSpacing = 5;
	nodesCanOverlap = false;
	connectionRenderMode = 'bezier';
	private = {
		wolframAppId: localStorage.getItem('wolframAppId') ?? '',
		wolframAlphaEnabled: (localStorage.getItem('wolframAlphaEnabled') ?? 'true') == 'true',
		wolframAlphaCorsProxy: localStorage.getItem('wolframAlphaCorsProxy') ?? 'https://api.allorigins.win/raw?url=',
		logicNotation: parseInt(localStorage.getItem('logicNotation') ?? '2'),
		useXORSymbol: (localStorage.getItem('useXORSymbol') ?? 'true') == 'true'
	};

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
			if (key == 'private') {
				continue;
			}
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
