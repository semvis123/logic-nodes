<script lang="ts">
	import { hexByte, MODE_INDICATOR, charCountBits, type QrCode, type Field } from '$lib/qr';

	// The build of the current code, stage by stage. Long inputs are cut short
	// in each stage, with a note; every codeword is made the same way.
	export let qr: QrCode;

	const GROUPS_SHOWN = 16;
	const BITS_SHOWN = 160;
	const CODEWORDS_SHOWN = 48;
	const BLOCKS_SHOWN = 6;
	const SEQUENCE_SHOWN = 60;

	const fieldNote: Record<Field['kind'], string> = {
		mode: 'which encoding follows',
		count: 'how many characters',
		data: 'the characters',
		terminator: 'end of data',
		'bit-padding': 'to a byte boundary',
		'pad-bytes': '11101100 and 00010001 in turn'
	};

	$: bin8 = (n: number) => n.toString(2).padStart(8, '0');
	$: dataTotal = qr.blocks.reduce((n, b) => n + b.data.length, 0);
	$: padStart = qr.dataCodewords.length - qr.padCount;
	$: modeName = { numeric: 'Numeric', alphanumeric: 'Alphanumeric', byte: 'Byte' }[qr.mode];
	$: unitWord = qr.mode === 'byte' ? 'byte' : 'character';
	$: groupRule =
		qr.mode === 'numeric'
			? 'Digits go in threes, each three as a 10-bit number (a last pair takes 7 bits, a last single digit 4).'
			: qr.mode === 'alphanumeric'
			? 'Characters go in pairs: 45 × the first value + the second, in 11 bits. A last single character takes 6 bits.'
			: 'Each character becomes its UTF-8 bytes, 8 bits each.';
	$: shortBlocks = qr.blocks.filter((b) => b.data.length === qr.blocks[0].data.length).length;
</script>

<ol class="build">
	<li>
		<h3>Mode and character count</h3>
		<p>
			{modeName} mode, indicator <span class="mono strong">{MODE_INDICATOR[qr.mode]}</span>. The count is {qr.count}
			{unitWord}{qr.count === 1 ? '' : 's'}, written in {charCountBits(qr.mode, qr.version)} bits at version {qr.version}:
			<span class="mono strong">{qr.fields[1].bits}</span>.
		</p>
	</li>

	<li>
		<h3>Data bits</h3>
		<p>{groupRule}</p>
		{#if qr.groups.length}
			<div class="table-wrap scroll-box">
				<table class="data-table groups">
					<thead>
						<tr>
							<th scope="col">{qr.mode === 'byte' ? 'Character' : 'Characters'}</th>
							<th scope="col" class="num">Value</th>
							<th scope="col">Bits</th>
						</tr>
					</thead>
					<tbody>
						{#each qr.groups.slice(0, GROUPS_SHOWN) as g}
							<tr>
								<td class="mono">{g.chars ? g.chars.replace(/ /g, '␣') : '…'}</td>
								<td class="mono num">{qr.mode === 'byte' ? `0x${hexByte(g.value)}` : g.value}</td>
								<td class="mono strong">{g.bits}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if qr.groups.length > GROUPS_SHOWN}
				<p class="note">The first {GROUPS_SHOWN} of {qr.groups.length} groups.</p>
			{/if}
		{/if}
	</li>

	<li>
		<h3>The bit stream, filled to {qr.dataCodewords.length * 8} bits</h3>
		<p>
			Version {qr.version} at level {qr.ec} has room for {qr.dataCodewords.length} data codewords. After the data comes a
			terminator of up to four zeros, zeros to the end of the byte, then pad bytes until it is full.
		</p>
		<div class="stream">
			{#each qr.fields as f}
				{#if f.bits.length}
					<div class="field f-{f.kind}">
						<span class="field-name">{f.label} <span class="field-len">{f.bits.length} bits</span></span>
						<span class="field-bits mono"
							>{f.bits.length > BITS_SHOWN ? `${f.bits.slice(0, BITS_SHOWN)}…` : f.bits}</span
						>
						<span class="field-note">{fieldNote[f.kind]}</span>
					</div>
				{/if}
			{/each}
		</div>
	</li>

	<li>
		<h3>Data codewords</h3>
		<p>The stream cut into bytes. Pad bytes are marked.</p>
		<div class="cells">
			{#each qr.dataCodewords.slice(0, CODEWORDS_SHOWN) as c, i}
				<span class="cell" class:pad={i >= padStart}>
					<span class="cell-hex mono">{hexByte(c)}</span>
					<span class="cell-sub mono">{bin8(c)}</span>
					<span class="cell-tag">{i >= padStart ? 'pad' : `#${i + 1}`}</span>
				</span>
			{/each}
		</div>
		{#if qr.dataCodewords.length > CODEWORDS_SHOWN}
			<p class="note">The first {CODEWORDS_SHOWN} of {qr.dataCodewords.length}.</p>
		{/if}
	</li>

	<li>
		<h3>Error correction</h3>
		<p>
			{#if qr.blocks.length === 1}
				One block: the {qr.dataCodewords.length} data codewords, divided as a polynomial by the Reed–Solomon generator of
				degree
				{qr.blocks[0].ec.length}, leave a remainder of {qr.blocks[0].ec.length} error correction codewords.
			{:else}
				The data is split into {qr.blocks.length} blocks ({shortBlocks} of {qr.blocks[0].data.length} codewords{#if shortBlocks < qr.blocks.length},
					then {qr.blocks.length - shortBlocks} of {qr.blocks[qr.blocks.length - 1].data.length}{/if}), and each block
				gets its own {qr.blocks[0].ec.length} Reed–Solomon codewords, so damage in one spot only uses up one block's correction.
			{/if}
		</p>
		<div class="table-wrap scroll-box">
			<table class="data-table blocks">
				<thead>
					<tr>
						<th scope="col">Block</th>
						<th scope="col">Data codewords</th>
						<th scope="col">Error correction codewords</th>
					</tr>
				</thead>
				<tbody>
					{#each qr.blocks.slice(0, BLOCKS_SHOWN) as b, i}
						<tr>
							<td class="mono">{i + 1}</td>
							<td class="mono hexes">{b.data.map(hexByte).join(' ')}</td>
							<td class="mono hexes ec">{b.ec.map(hexByte).join(' ')}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if qr.blocks.length > BLOCKS_SHOWN}
			<p class="note">The first {BLOCKS_SHOWN} of {qr.blocks.length} blocks.</p>
		{/if}
	</li>

	<li>
		<h3>Interleaving and placement</h3>
		<p>
			{#if qr.blocks.length === 1}
				With one block there is nothing to interleave: the data codewords go first, then the error correction.
			{:else}
				The first codeword of every block, then the second of every block, and so on; then the error correction
				codewords the same way. A scratch across the symbol then hits several blocks a little rather than one a lot.
			{/if}
			That makes {qr.sequence.length} codewords, placed two columns at a time from the bottom right, zigzagging up and down
			and stepping round the patterns.{#if qr.remainderBits}
				{qr.remainderBits} remainder bit{qr.remainderBits === 1 ? '' : 's'} fill the modules left over.{/if}
		</p>
		<div class="cells">
			{#each qr.sequence.slice(0, SEQUENCE_SHOWN) as c, i}
				{@const o = qr.origin[i]}
				<span class="cell" class:ec-cell={o.kind === 'ec'}>
					<span class="cell-hex mono">{hexByte(c)}</span>
					<span class="cell-tag"
						>{i + 1}: {o.kind === 'data' ? 'D' : 'E'}{qr.blocks.length > 1 ? `${o.block + 1}.` : ''}{o.index + 1}</span
					>
				</span>
			{/each}
		</div>
		<p class="note">
			{#if qr.sequence.length > SEQUENCE_SHOWN}The first {SEQUENCE_SHOWN} of {qr.sequence.length}.{/if}
			D is data and E error correction{qr.blocks.length > 1 ? ', then block.position' : ''}; codewords {dataTotal + 1} on
			are error correction.
		</p>
	</li>
</ol>

<style>
	.build {
		counter-reset: step;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.build > li {
		border-left: 2px solid rgba(93, 182, 93, 0.5);
		counter-increment: step;
		margin: 0 0 1.4rem;
		padding: 0 0 0 1rem;
	}

	.build h3::before {
		color: #8ede8e;
		content: counter(step) '. ';
	}

	.build p {
		margin: 0.3rem 0 0.6rem;
		max-width: 700px;
	}

	.strong {
		color: #8ede8e !important;
		font-weight: 700;
	}

	.num {
		text-align: right !important;
	}

	.scroll-box {
		max-height: 360px;
		overflow: auto;
	}

	.groups td {
		white-space: nowrap;
	}

	.hexes {
		min-width: 14rem;
		overflow-wrap: anywhere;
	}

	.blocks td.ec {
		color: #f0b47a;
	}

	.stream {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.field {
		background: #101012;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-top-width: 3px;
		border-radius: 3px;
		display: flex;
		flex-direction: column;
		max-width: 100%;
		min-width: 0;
		padding: 0.3rem 0.5rem;
	}

	.field-name {
		color: #fff;
		font-size: 0.78rem;
		font-weight: 600;
	}

	.field-len {
		color: #999;
		font-weight: normal;
	}

	.field-bits {
		font-size: 0.85rem;
		overflow-wrap: anywhere;
		word-break: break-all;
	}

	.field-note {
		color: #999;
		font-size: 0.72rem;
	}

	.f-mode {
		border-top-color: #7fb2ff;
	}

	.f-count {
		border-top-color: #d4a5ff;
	}

	.f-data {
		border-top-color: #5db65d;
		flex: 1 1 16rem;
	}

	.f-terminator,
	.f-bit-padding {
		border-top-color: #888;
	}

	.f-pad-bytes {
		border-top-color: #f0b47a;
		flex: 1 1 12rem;
	}

	.cells {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.cell {
		align-items: center;
		background: #101012;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		display: inline-flex;
		flex-direction: column;
		min-width: 2.6rem;
		padding: 0.15rem 0.35rem;
	}

	.cell.pad {
		border-style: dashed;
	}

	.cell.ec-cell {
		border-color: rgba(240, 180, 122, 0.7);
	}

	.cell-hex {
		color: #fff !important;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.cell.ec-cell .cell-hex {
		color: #f0b47a !important;
	}

	.cell-sub {
		color: #bbb !important;
		font-size: 0.66rem;
	}

	.cell-tag {
		color: #aaa;
		font-size: 0.66rem;
		white-space: nowrap;
	}

	.note {
		color: #bbb;
		font-size: 0.8rem;
	}
</style>
