import type { NodeSaveFile } from './NodeSaveFile';

export const playground: NodeSaveFile = {
	nodes: [
		{
			id: '2531854083-3437458643-2559285022-452133887',
			type: 'ToggleNode',
			x: 300,
			y: 100,
			defaultValue: 1
		},
		{
			id: '2559285022-452133887-3437458643-2531854083',
			type: 'ClockNode',
			x: 300,
			y: 300,
			interval: 1000
		},
		{
			id: '452133887-2559285022-2531854083-3437458643',
			type: 'AndNode',
			x: 400,
			y: 200
		},
		{
			id: '2531854233-343745224-2559281122-4533333887',
			type: 'OrNode',
			x: 500,
			y: 300
		},
		{
			id: '4533333887-2531854233-343745224-2559281122',
			type: 'NotNode',
			x: 300,
			y: 400
		},
		{
			id: '453334887-4443523525-2342342334-3423423423',
			type: 'DisplayNode',
			x: 600,
			y: 200
		},
		{
			id: '2342342334-4443523525-2342342334-3423423423',
			type: 'DelayNode',
			x: 200,
			y: 400,
			delay: 400
		},
		{
			id: '2342342134-2342341667-2342342334-3423423423',
			type: 'DelayNode',
			x: 200,
			y: 300,
			delay: 1000
		},
		{
			id: '4443523525-2342342334-3423423423-2559281122',
			type: 'HtmlOverlayNode',
			x: 800,
			y: 300
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
			nodeBorderRadius: 3
		},
		renderMode: 'variable',
		hardwareAccelerationHtmlOverlay: true
	}
};
