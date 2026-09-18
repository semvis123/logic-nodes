// The shapes every lesson is built from. Lessons live in src/lib/course/lessons
// (metadata and question generators) and src/lib/course/content (the prose and
// widgets, one Svelte component per lesson); the registry in lessons.ts joins
// the two and puts them in teaching order.

import type { TruthTable } from '../boolean.js';

/** A deterministic source of numbers in [0, 1), so a seed replays a question. */
export type Random = () => number;

export interface CourseQuestion {
	prompt: string;
	/** Shown in a monospace box under the prompt, for an expression or a number. */
	detail?: string;
	/** Rendered as a truth table when present. */
	table?: TruthTable;
	tableOutputLabel?: string;
	/** A circuit diagram, already rendered to SVG. */
	svg?: string;
	svgAlt?: string;
	options: string[];
	/** Index into options. */
	answer: number;
	/**
	 * Two hints, shown after the first and the second wrong answer. The first
	 * points at the idea, the second nearly does the work; after a third wrong
	 * answer the explanation is shown with the answer.
	 */
	hints: [string, string];
	explanation: string;
}

export type QuestionGenerator = (random: Random) => CourseQuestion;

export interface LessonLink {
	href: string;
	label: string;
}

export interface LessonMeta {
	slug: string;
	title: string;
	/** One sentence for the roadmap and the course home. */
	blurb: string;
	/** The meta description, under 160 characters. */
	description: string;
	/** Rough reading and practice time. */
	minutes: number;
	/** At least one; the quiz picks among them at random. */
	generators: QuestionGenerator[];
	/** Reference pages to read once the lesson is done. */
	deeper: LessonLink[];
	/** An optional thing to build in the simulator. */
	build?: LessonLink;
}

export interface StageMeta {
	id: string;
	title: string;
	/** What the stage is for, in plain words, for the course home. */
	tagline: string;
	lessons: LessonMeta[];
}

/** Right answers in a row needed before a lesson counts as passed. */
export const PASS_STREAK = 5;
