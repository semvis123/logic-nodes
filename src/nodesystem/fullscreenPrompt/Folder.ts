import type { SaveMetadata } from '../SaveManager';

export type Folder = {
	name: string;
	files: SaveMetadata[];
	directories: Folder[];
};
