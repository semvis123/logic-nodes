<script lang="ts">
	// The simplest circuit there is: a switch, a wire and a lamp. Green is 1,
	// red is 0, the same colours the simulator uses for its wires.
	export let label = 'A switch, a wire and a lamp. Click the switch.';
	let on = false;
</script>

<div class="widget wire">
	<p class="widget-title">{label}</p>
	<div class="row">
		<button type="button" class="toggle" class:on aria-pressed={on} on:click={() => (on = !on)}>
			switch <span class="val">{on ? 1 : 0}</span>
		</button>
		<span class="line" class:on aria-hidden="true" />
		<span class="lamp big" class:on role="img" aria-label={on ? 'lamp on' : 'lamp off'} />
		<span class="reading" aria-live="polite">The wire carries a <strong class="mono">{on ? 1 : 0}</strong></span>
	</div>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.line {
		display: inline-block;
		width: 80px;
		height: 3px;
		background-color: #f23;
		border-radius: 2px;
	}

	.line.on {
		background-color: #5db65d;
	}

	.big {
		width: 22px !important;
		height: 22px !important;
	}

	.reading {
		color: #ddd;
	}
</style>
