import type { NodeParameter } from './fullscreenPrompt/FullscreenPrompt';

export const metadataCategories = ['Logic', 'Input', 'Output', 'Generators', 'Misc'] as const;

export type MetadataCategory = typeof metadataCategories[number];

export type Metadata = {
	displayName: string;
	category?: MetadataCategory;
	parameters: NodeParameter[];
};
