import type { NodeSaveFile } from './NodeSaveFile';

export const playground: NodeSaveFile = {
	nodes: [
		{
			type: 'LabelNode',
			id: '2215298922-3586061178-2392721345-2528722267',
			x: 813,
			y: 177,
			parameters: [
				{ name: 'text', label: 'Text', value: 'Welcome!', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#00458f', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: '20', type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '3363868895-1809701562-2119423607-2429462360',
			x: 273,
			y: 250,
			parameters: [
				{ name: 'text', label: 'Text', value: 'Push the button to set off a wave!', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#ffffff', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: '15', type: 'number', step: 1 }
			]
		},
		{
			type: 'ButtonNode',
			id: '3778716499-183627296-723359257-769801344',
			x: 364,
			y: 298,
			parameters: [{ name: 'delay', label: 'Delay', value: '1000', type: 'number', required: true, min: 50 }]
		},
		{
			type: 'DisplayNode',
			id: '2633280092-2620900187-4292345156-4280848386',
			x: 738,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '1802355849-11458641-3351137560-4128086629',
			x: 784,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '3467246155-512990884-2990164662-2058759897',
			x: 692,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '3764754-3068155643-438440794-4257502876',
			x: 876,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '1265432186-208558516-3825718706-3980338381',
			x: 646,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '606503957-290840581-1322953966-3105744094',
			x: 830,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '4015334938-4077421143-4250984830-857019245',
			x: 922,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DelayNode',
			id: '476838887-1415552505-4283375351-1494692377',
			x: 645,
			y: 431,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '2912908479-2968947325-2069609062-1125841124',
			x: 691,
			y: 431,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '3897310430-2252657838-2304205119-3373182690',
			x: 737,
			y: 431,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '3125780112-597918958-404433780-330807493',
			x: 783,
			y: 431,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '116945493-235452758-2968601763-2826776672',
			x: 830,
			y: 431,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '55154202-2584336738-1016591096-2931816057',
			x: 876,
			y: 430,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '3782432695-1199461989-3412695549-3299211181',
			x: 923,
			y: 431,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DisplayNode',
			id: '835408438-3952340213-4237964783-2775550038',
			x: 968,
			y: 477,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '4057643785-1946314502-2194823244-4259243301',
			x: 1061,
			y: 479,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DisplayNode',
			id: '2612108912-2637077760-69537536-13904153',
			x: 1014,
			y: 478,
			parameters: [{ name: 'showValue', label: 'Show Value', checked: false, type: 'checkbox' }]
		},
		{
			type: 'DelayNode',
			id: '43804305-2423260354-2441450013-2033170831',
			x: 969,
			y: 431,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '3729305905-1607199776-2907734666-2150148577',
			x: 1061,
			y: 432,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'DelayNode',
			id: '401075017-799819188-1983788860-3690463565',
			x: 1015,
			y: 432,
			parameters: [{ name: 'delay', label: 'Delay', value: 100, type: 'number', required: true, min: 10 }]
		},
		{
			type: 'ToggleNode',
			id: '2893587412-3288297597-3978054495-3343258386',
			x: 328,
			y: 596,
			parameters: [
				{ name: 'defaultValue', label: 'Default value', value: '0', type: 'number', required: true, min: 0, max: 1 }
			]
		},
		{
			type: 'ClockNode',
			id: '492494545-3240806690-2850398187-3927923961',
			x: 410,
			y: 661,
			parameters: [{ name: 'interval', label: 'Interval', value: '1000', type: 'number', required: true, min: 10 }]
		},
		{ type: 'OrNode', id: '1419741519-1483481934-2786448437-1072083779', x: 578, y: 431, parameters: [] },
		{
			type: 'AndNode',
			id: '1154075765-784170684-402687479-853855479',
			x: 480,
			y: 625,
			parameters: [{ name: 'inputs', label: 'Inputs', value: 2, type: 'number', required: true, min: 1 }]
		},
		{
			type: 'LabelNode',
			id: '3718277248-493232146-2034815473-3168960788',
			x: 188,
			y: 558,
			parameters: [
				{ name: 'text', label: 'Text', value: 'Or use the switch to turn on the wave generator', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#ffffff', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: '15', type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '1191177154-1732972616-4211502845-3050298132',
			x: 164,
			y: 42,
			parameters: [
				{ name: 'text', label: 'Text', value: '---------------', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '1969924531-3963499763-4182992441-677127989',
			x: 140,
			y: 69,
			parameters: [
				{ name: 'text', label: 'Text', value: '^', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '3307049754-2892819731-310903567-3299444461',
			x: 138,
			y: 100,
			parameters: [
				{ name: 'text', label: 'Text', value: 'Click here to add new nodes', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#ededed', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '1631111024-3939314848-1545992771-679837741',
			x: 140,
			y: 39,
			parameters: [
				{ name: 'text', label: 'Text', value: '^', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '3825972261-177425363-2019806435-2252395165',
			x: 262,
			y: 43,
			parameters: [
				{ name: 'text', label: 'Text', value: '----------------', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '985955320-2983415931-2393825317-4251266594',
			x: 343,
			y: 43,
			parameters: [
				{ name: 'text', label: 'Text', value: '^', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '587937557-3553047583-3425635511-859611660',
			x: 241,
			y: 42,
			parameters: [
				{ name: 'text', label: 'Text', value: '^', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '2775188730-2285046606-4175493030-297924852',
			x: 365,
			y: 42,
			parameters: [
				{ name: 'text', label: 'Text', value: '----------------', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		},
		{
			type: 'LabelNode',
			id: '1135982736-542533373-1187416028-1957453594',
			x: 448,
			y: 43,
			parameters: [
				{ name: 'text', label: 'Text', value: '^', type: 'text' },
				{ name: 'bgcolor', label: 'Background color', value: '#161618', type: 'color' },
				{ name: 'fontsize', label: 'Font size', value: 12, type: 'number', step: 1 }
			]
		}
	],
	connections: [
		{
			from: { nodeId: '476838887-1415552505-4283375351-1494692377', index: 0 },
			to: { nodeId: '1265432186-208558516-3825718706-3980338381', index: 0 }
		},
		{
			from: { nodeId: '476838887-1415552505-4283375351-1494692377', index: 0 },
			to: { nodeId: '2912908479-2968947325-2069609062-1125841124', index: 0 }
		},
		{
			from: { nodeId: '2912908479-2968947325-2069609062-1125841124', index: 0 },
			to: { nodeId: '3897310430-2252657838-2304205119-3373182690', index: 0 }
		},
		{
			from: { nodeId: '2912908479-2968947325-2069609062-1125841124', index: 0 },
			to: { nodeId: '3467246155-512990884-2990164662-2058759897', index: 0 }
		},
		{
			from: { nodeId: '3897310430-2252657838-2304205119-3373182690', index: 0 },
			to: { nodeId: '3125780112-597918958-404433780-330807493', index: 0 }
		},
		{
			from: { nodeId: '3897310430-2252657838-2304205119-3373182690', index: 0 },
			to: { nodeId: '2633280092-2620900187-4292345156-4280848386', index: 0 }
		},
		{
			from: { nodeId: '3125780112-597918958-404433780-330807493', index: 0 },
			to: { nodeId: '116945493-235452758-2968601763-2826776672', index: 0 }
		},
		{
			from: { nodeId: '3125780112-597918958-404433780-330807493', index: 0 },
			to: { nodeId: '1802355849-11458641-3351137560-4128086629', index: 0 }
		},
		{
			from: { nodeId: '116945493-235452758-2968601763-2826776672', index: 0 },
			to: { nodeId: '606503957-290840581-1322953966-3105744094', index: 0 }
		},
		{
			from: { nodeId: '116945493-235452758-2968601763-2826776672', index: 0 },
			to: { nodeId: '55154202-2584336738-1016591096-2931816057', index: 0 }
		},
		{
			from: { nodeId: '55154202-2584336738-1016591096-2931816057', index: 0 },
			to: { nodeId: '3782432695-1199461989-3412695549-3299211181', index: 0 }
		},
		{
			from: { nodeId: '55154202-2584336738-1016591096-2931816057', index: 0 },
			to: { nodeId: '3764754-3068155643-438440794-4257502876', index: 0 }
		},
		{
			from: { nodeId: '3782432695-1199461989-3412695549-3299211181', index: 0 },
			to: { nodeId: '4015334938-4077421143-4250984830-857019245', index: 0 }
		},
		{
			from: { nodeId: '3782432695-1199461989-3412695549-3299211181', index: 0 },
			to: { nodeId: '43804305-2423260354-2441450013-2033170831', index: 0 }
		},
		{
			from: { nodeId: '3778716499-183627296-723359257-769801344', index: 0 },
			to: { nodeId: '1419741519-1483481934-2786448437-1072083779', index: 0 }
		},
		{
			from: { nodeId: '43804305-2423260354-2441450013-2033170831', index: 0 },
			to: { nodeId: '401075017-799819188-1983788860-3690463565', index: 0 }
		},
		{
			from: { nodeId: '43804305-2423260354-2441450013-2033170831', index: 0 },
			to: { nodeId: '835408438-3952340213-4237964783-2775550038', index: 0 }
		},
		{
			from: { nodeId: '401075017-799819188-1983788860-3690463565', index: 0 },
			to: { nodeId: '2612108912-2637077760-69537536-13904153', index: 0 }
		},
		{
			from: { nodeId: '401075017-799819188-1983788860-3690463565', index: 0 },
			to: { nodeId: '3729305905-1607199776-2907734666-2150148577', index: 0 }
		},
		{
			from: { nodeId: '3729305905-1607199776-2907734666-2150148577', index: 0 },
			to: { nodeId: '4057643785-1946314502-2194823244-4259243301', index: 0 }
		},
		{
			from: { nodeId: '492494545-3240806690-2850398187-3927923961', index: 0 },
			to: { nodeId: '1154075765-784170684-402687479-853855479', index: 1 }
		},
		{
			from: { nodeId: '2893587412-3288297597-3978054495-3343258386', index: 0 },
			to: { nodeId: '1154075765-784170684-402687479-853855479', index: 0 }
		},
		{
			from: { nodeId: '1154075765-784170684-402687479-853855479', index: 0 },
			to: { nodeId: '1419741519-1483481934-2786448437-1072083779', index: 1 }
		},
		{
			from: { nodeId: '1419741519-1483481934-2786448437-1072083779', index: 0 },
			to: { nodeId: '476838887-1415552505-4283375351-1494692377', index: 0 }
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
