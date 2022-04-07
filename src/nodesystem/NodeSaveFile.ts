export interface NodeSaveFile {
	nodes: {
		id: string;
		type: string;
		x: number;
		y: number;
		interval?: number;
		defaultValue?: number;
		delay?: number;
	}[];
	connections: {
		from: {
			nodeId: string;
			index: number;
		};
		to: {
			nodeId: string;
			index: number;
		};
	}[];
	config?: {
		theme?: {
			backgroundColor?: string;
			nodeBackfroundColor?: string;
			nodeBorderColor?: string;
			nodeTextColor?: string;
			connectionColor?: string;
			nodeSelectedColor?: string;
			nodeSelectionSquareColor?: string;
			connectionPointRadius?: number;
			nodeBorderRadius?: number;
		};
		renderMode?: 'variable';
		hardwareAccelerationHtmlOverlay?: boolean;
	};
}
