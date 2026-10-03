<script lang="ts">
	import { scrollRegion } from '$lib/scrollRegion';
	import { overflowRules } from '$lib/intLimits';
</script>

<div class="table-wrap" use:scrollRegion data-label="What each language does on overflow">
	<table class="data-table rules">
		<caption class="visually-hidden">What each language does when integer arithmetic overflows</caption>
		<thead>
			<tr>
				<th scope="col">Language</th>
				<th scope="col">By default</th>
				<th scope="col">To check or wrap on purpose</th>
			</tr>
		</thead>
		<tbody>
			{#each overflowRules as rule}
				<tr>
					<th scope="row">{rule.language}</th>
					<td>{rule.behaviour}</td>
					<td class="tools">{rule.tools}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.rules {
		min-width: 600px;
	}

	.rules th[scope='row'] {
		color: #fff;
		white-space: nowrap;
		vertical-align: top;
	}

	.rules td {
		color: #ddd;
		font-size: 0.9rem;
		vertical-align: top;
	}

	.rules .tools {
		color: #bbb;
		font-size: 0.85rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
