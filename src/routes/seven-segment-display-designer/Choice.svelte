<script lang="ts">
	// A labelled group of toggle buttons, one pressed at a time.
	export let label: string;
	export let options: [string, string][];
	export let value: string;
	/** Stretch the buttons across the row (the main switch). */
	export let fill = false;
	export let hideLabel = false;
</script>

<div class="opt" class:fill role="group" aria-label={label}>
	{#if !hideLabel}<span class="opt-label">{label}</span>{/if}
	{#each options as [v, text]}
		<button type="button" class:active={value === v} aria-pressed={value === v} on:click={() => (value = v)}
			>{text}</button
		>
	{/each}
</div>

<style>
	.opt {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}
	.opt-label {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.15rem;
	}
	button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
	}
	.fill {
		display: flex;
		margin-bottom: 0.9rem;
	}
	.fill button {
		flex: 1 1 0;
		font-size: 0.95rem;
		padding: 0.5rem 0.4rem;
	}
	button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
		font-weight: 600;
	}
	@media (max-width: 420px) {
		.fill button {
			font-size: 0.85rem;
		}
	}
</style>
