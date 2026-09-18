<script lang="ts">
	// The boxes that sit beside the main text of a lesson. "why" and "mistake"
	// fold away so a reader in a hurry can skip them; "term" and "tip" stay
	// open because they are short and the reader needs them right there.
	export let kind: 'why' | 'mistake' | 'term' | 'tip' = 'why';
	export let title = '';

	const labels = { why: 'Why?', mistake: 'Common mistake', term: 'New word', tip: 'Tip' };
	$: heading = title ? `${labels[kind]}: ${title}` : labels[kind];
</script>

{#if kind === 'term' || kind === 'tip'}
	<aside class="aside {kind}">
		<p class="aside-title">{heading}</p>
		<div class="aside-body"><slot /></div>
	</aside>
{:else}
	<details class="aside {kind}">
		<summary>{heading}</summary>
		<div class="aside-body"><slot /></div>
	</details>
{/if}

<style>
	.aside {
		border-left: 3px solid #5db65d;
		background-color: #161618;
		border-radius: 0 3px 3px 0;
		padding: 0.6rem 0.9rem;
		margin: 1rem 0;
		font-size: 0.95rem;
	}

	.aside.mistake {
		border-left-color: #f23;
	}

	.aside.term {
		border-left-color: #6aa7ff;
	}

	.aside.tip {
		border-left-color: #e2b93b;
	}

	.aside-title,
	summary {
		font-weight: 600;
		color: #fff;
		margin: 0;
	}

	summary {
		cursor: pointer;
	}

	.aside-body {
		margin-top: 0.4rem;
	}

	/* The body is prose, so keep the paragraphs tight inside the box. */
	.aside-body :global(p) {
		margin: 0 0 0.5rem;
		color: #ccc;
	}

	.aside-body :global(p:last-child) {
		margin-bottom: 0;
	}

	@media print {
		.aside {
			background: #fff;
			border: 1px solid #999;
			border-left-width: 3px;
		}
	}
</style>
