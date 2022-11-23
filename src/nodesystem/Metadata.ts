import type { NodeParameter } from './fullscreenPrompt/FullscreenPrompt';

export const metadataCategories = ['Logic', 'Input', 'Output', 'Generators', 'Misc', 'Custom'] as const;

export type MetadataCategory = typeof metadataCategories[number];

export type Metadata = {
	nodeName: string;
	displayName: string;
	category?: MetadataCategory;
	parameters: NodeParameter[];
	hideFromMenu?: boolean;
};
