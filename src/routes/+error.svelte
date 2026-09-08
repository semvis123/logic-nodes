<script lang="ts">
	import { page } from '$app/stores';
	import ContentPage from '$lib/ContentPage.svelte';
	import { tools } from '$lib/tools';

	// A wrong URL should still land somewhere useful, so this offers the same
	// routes the nav does rather than a bare status code.
	const sections = [
		{ href: '/learn', label: 'Learn digital logic', blurb: 'Eight steps from one wire to a working adder.' },
		{
			href: '/logic-gates',
			label: 'The six logic gates',
			blurb: 'AND, OR, NOT, XOR, NAND and NOR, with truth tables.'
		},
		{ href: '/flip-flops', label: 'Flip-flops', blurb: 'D, JK, SR and T, with their excitation tables.' },
		{ href: '/practice', label: 'Practice', blurb: 'Generated questions, marked as you go.' }
	];
</script>

<svelte:head>
	<title>{$page.status === 404 ? 'Page not found' : 'Something went wrong'} · Logic Nodes</title>
	<!-- An error page must never be indexed, whatever URL it was reached at. -->
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<ContentPage
	related={[
		{ href: '/', label: 'Home' },
		{ href: '/tools', label: 'All tools' },
		{ href: '/simulator', label: 'Open the simulator' }
	]}
>
	<section class="intro">
		<p class="status">{$page.status}</p>
		<h1>
			{#if $page.status === 404}
				That page is not here
			{:else}
				Something went wrong
			{/if}
		</h1>
		<p class="lede">
			{#if $page.status === 404}
				The address <span class="mono">{$page.url.pathname}</span> does not match anything on this site. It may have moved,
				or the link may have been mistyped.
			{:else}
				{$page.error?.message ?? 'An unexpected error occurred.'} Reloading may be enough; if not, the pages below all work.
			{/if}
		</p>
		<p class="cta-row">
			<a class="cta" href="/simulator">Open the simulator</a>
			<a class="secondary" href="/">Go to the homepage</a>
		</p>
	</section>

	<section>
		<h2>Start here instead</h2>
		<div class="grid">
			{#each sections as item}
				<a class="card link-card" href={item.href}>
					<span class="card-title">{item.label}</span>
					<span class="card-blurb">{item.blurb}</span>
				</a>
			{/each}
		</div>
	</section>

	<section>
		<h2>Or a tool</h2>
		<div class="grid">
			{#each tools as tool}
				<a class="card link-card" href={tool.href}>
					<span class="card-title">{tool.name}</span>
					<span class="card-blurb">{tool.blurb}</span>
				</a>
			{/each}
		</div>
	</section>
</ContentPage>

<style>
	.status {
		color: #5db65d;
		font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
		font-size: 0.9rem;
		letter-spacing: 0.08em;
		margin: 0 0 0.3rem;
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin-top: 1.4rem;
	}

	.secondary {
		color: #8ede8e;
		font-size: 0.9rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 0.8rem;
	}

	.link-card {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		text-decoration: none;
	}

	.link-card:hover {
		border-color: #5db65d;
	}

	.card-title {
		color: #fff;
		font-weight: 600;
	}

	.card-blurb {
		color: #bbb;
		font-size: 0.85rem;
	}
</style>
