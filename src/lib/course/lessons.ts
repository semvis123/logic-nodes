// The course, in teaching order. Each stage file holds the metadata and the
// question generators for its lessons; the prose for a lesson is the Svelte
// component of the same slug in ./content, which the lesson route loads.

import { bits } from './lessons/bits.js';
import { gates } from './lessons/gates.js';
import { algebra } from './lessons/algebra.js';
import { smaller } from './lessons/smaller.js';
import { build } from './lessons/build.js';
import { memory } from './lessons/memory.js';
import { sequential } from './lessons/sequential.js';
import { project } from './lessons/project.js';
import type { LessonMeta, StageMeta } from './types.js';

export const stages: StageMeta[] = [bits, gates, algebra, smaller, build, memory, sequential, project];

export const allLessons: LessonMeta[] = stages.flatMap((stage) => stage.lessons);

export const lessonBySlug = (slug: string) => allLessons.find((lesson) => lesson.slug === slug);

export const stageOf = (slug: string) => stages.find((stage) => stage.lessons.some((l) => l.slug === slug));

/** The lessons either side of one, for the previous and next links. */
export function neighbours(slug: string): { previous?: LessonMeta; next?: LessonMeta } {
	const index = allLessons.findIndex((lesson) => lesson.slug === slug);
	return { previous: allLessons[index - 1], next: allLessons[index + 1] };
}

/** Where a lesson sits: stage number and lesson number within it, 1-based. */
export function position(slug: string): { stage: number; lesson: number; of: number } {
	for (const [s, stage] of stages.entries()) {
		const l = stage.lessons.findIndex((lesson) => lesson.slug === slug);
		if (l >= 0) return { stage: s + 1, lesson: l + 1, of: stage.lessons.length };
	}
	return { stage: 0, lesson: 0, of: 0 };
}

export const totalMinutes = allLessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
