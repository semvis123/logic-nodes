<script lang="ts">
	// A generated reference chart (black on white), linked to its PNG for
	// download. The size and alt text come from the manifest, so the page never
	// hardcodes either and the image reserves its space before it loads.
	import { generatedImage } from '$lib/generatedImages';

	export let file: string;

	$: image = generatedImage(file);
</script>

<a class="card-image" href="/img/{image.file}" download>
	<img
		src="/img/{image.file}"
		alt={image.alt}
		width={image.width}
		height={image.height}
		loading="lazy"
		decoding="async"
	/>
	<span class="card-caption">Click to download: {image.title}</span>
</a>

<style>
	.card-image {
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		text-decoration: none;
		max-width: 720px;
		margin-bottom: 0.9rem;
	}

	.card-image img {
		display: block;
		width: 100%;
		max-width: 100%;
		height: auto;
		/* The chart is black on white, so it carries its own page colour. */
		background: #fff;
	}

	.card-caption {
		display: block;
		background: #161618;
		color: #8ede8e;
		font-size: 0.8rem;
		padding: 0.5rem 0.8rem;
	}
</style>
