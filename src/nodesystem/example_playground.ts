import type { NodeSaveFile } from './NodeSaveFile';

export const playground: NodeSaveFile = {
	nodes: [
		{
			type: 'ToggleNode',
			id: '2531854083-3437458643-2559285022-452133887',
			x: 300,
			y: 100,
			parameters: [
				{
					name: 'defaultValue',
					label: 'Default value',
					value: 1,
					type: 'number',
					required: true,
					min: 0,
					max: 1
				}
			]
		},
		{
			type: 'ClockNode',
			id: '2559285022-452133887-3437458643-2531854083',
			x: 300,
			y: 300,
			parameters: [
				{
					name: 'interval',
					label: 'Interval',
					value: 100,
					type: 'number',
					required: true,
					min: 10
				}
			]
		},
		{
			type: 'AndNode',
			id: '452133887-2559285022-2531854083-3437458643',
			x: 400,
			y: 200,
			parameters: [
				{
					name: 'inputs',
					label: 'Inputs',
					value: 2,
					type: 'number',
					required: true,
					min: 1
				}
			]
		},
		{
			type: 'OrNode',
			id: '2531854233-343745224-2559281122-4533333887',
			x: 500,
			y: 300,
			parameters: []
		},
		{
			type: 'NotNode',
			id: '4533333887-2531854233-343745224-2559281122',
			x: 300,
			y: 400,
			parameters: []
		},
		{
			type: 'DisplayNode',
			id: '453334887-4443523525-2342342334-3423423423',
			x: 600,
			y: 200,
			parameters: [
				{
					name: 'showValue',
					label: 'Show Value',
					checked: false,
					type: 'checkbox'
				}
			]
		},
		{
			type: 'DelayNode',
			id: '2342342334-4443523525-2342342334-3423423423',
			x: 200,
			y: 400,
			parameters: [
				{
					name: 'delay',
					label: 'Delay',
					value: 100,
					type: 'number',
					required: true,
					min: 10
				}
			]
		},
		{
			type: 'DelayNode',
			id: '2342342134-2342341667-2342342334-3423423423',
			x: 200,
			y: 300,
			parameters: [
				{
					name: 'delay',
					label: 'Delay',
					value: 100,
					type: 'number',
					required: true,
					min: 10
				}
			]
		},
		{
			type: 'HtmlOverlayNode',
			id: '4443523525-2342342334-3423423423-2559281122',
			x: 800,
			y: 300,
			parameters: []
		}
	],
	connections: [
		{
			from: {
				nodeId: '2531854083-3437458643-2559285022-452133887',
				index: 0
			},
			to: {
				nodeId: '452133887-2559285022-2531854083-3437458643',
				index: 0
			}
		},
		{
			from: {
				nodeId: '2559285022-452133887-3437458643-2531854083',
				index: 0
			},
			to: {
				nodeId: '452133887-2559285022-2531854083-3437458643',
				index: 1
			}
		},
		{
			from: {
				nodeId: '452133887-2559285022-2531854083-3437458643',
				index: 0
			},
			to: {
				nodeId: '453334887-4443523525-2342342334-3423423423',
				index: 0
			}
		}
	],
	config: {
		theme: {
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
		},
		renderMode: 'variable',
		hardwareAccelerationHtmlOverlay: true,
		colorConnectionLines: true,
		nodeSpacing: 5,
		nodesCanOverlap: false
	}
};
