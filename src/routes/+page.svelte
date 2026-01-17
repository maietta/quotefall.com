<script lang="ts">
	import { onMount } from 'svelte';
	import {
		generatePuzzle,
		type Puzzle,
		type Cell,
		type ColumnLetter,
		verifyChar,
		decode
	} from '$lib/game';
	import { quotes } from '$lib/quotes';
	import { fade, fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import confetti from 'canvas-confetti';

	let puzzle = $state<Puzzle | null>(null);
	let selectedUpper = $state<{ col: number; index: number } | null>(null);
	let selectedLower = $state<{ row: number; col: number } | null>(null);
	let isComplete = $state(false);
	let showInstructions = $state(false);
	let score = $state(0);
	let isSolving = $state(false);
	let forfeitScore = $state(false);
	let decodedAuthor = $state('');

	function initGame() {
		const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
		puzzle = generatePuzzle(randomQuote.text, randomQuote.author);
		isComplete = false;
		selectedUpper = null;
		selectedLower = null;
		score = 0;
		isSolving = false;
		forfeitScore = false;
		decodedAuthor = randomQuote.author || '';
	}

	onMount(() => {
		initGame();
	});

	function handleUpperClick(col: number, index: number) {
		if (puzzle?.columns[col][index].isUsed || isSolving) return;

		if (selectedUpper?.col === col && selectedUpper?.index === index) {
			selectedUpper = null;
		} else {
			selectedUpper = { col, index };
		}

		if (selectedLower && selectedLower.col === col && selectedUpper) {
			placeLetter(selectedUpper.col, selectedUpper.index, selectedLower.row, selectedLower.col);
		}
	}

	function handleLowerClick(row: number, col: number) {
		if (isSolving) return;
		const cell = puzzle?.grid[row][col];
		if (!cell || !cell.isLetter) return;

		if (cell.value) {
			removeLetter(row, col);
		}

		if (selectedLower?.row === row && selectedLower?.col === col) {
			selectedLower = null;
		} else {
			selectedLower = { row, col };
		}

		if (selectedUpper && selectedUpper.col === col && selectedLower) {
			placeLetter(selectedUpper.col, selectedUpper.index, selectedLower.row, selectedLower.col);
		}
	}

	function placeLetter(upCol: number, upIndex: number, lowRow: number, lowCol: number) {
		if (!puzzle) return;

		const upperLetter = puzzle.columns[upCol][upIndex];
		const lowerCell = puzzle.grid[lowRow][lowCol];

		if (upperLetter.isUsed || lowerCell.value) return;

		lowerCell.value = upperLetter.char;
		upperLetter.isUsed = true;

		if (!forfeitScore) {
			score += 10;
		}

		selectedUpper = null;
		selectedLower = null;

		checkWin();
		findNextEmptyCell(lowRow, lowCol);
	}

	function findNextEmptyCell(row: number, col: number) {
		if (!puzzle) return;
		let nextCol = col + 1;
		let nextRow = row;

		while (nextRow < puzzle.height) {
			while (nextCol < puzzle.width) {
				if (puzzle.grid[nextRow][nextCol].isLetter && !puzzle.grid[nextRow][nextCol].value) {
					selectedLower = { row: nextRow, col: nextCol };
					return;
				}
				nextCol++;
			}
			nextCol = 0;
			nextRow++;
		}
	}

	function removeLetter(row: number, col: number) {
		if (!puzzle) return;
		const cell = puzzle.grid[row][col];
		const char = cell.value;
		cell.value = '';

		if (!forfeitScore) {
			score = Math.max(0, score - 5);
		}

		const unusedLetter = puzzle.columns[col].find((l) => l.char === char && l.isUsed);
		if (unusedLetter) {
			unusedLetter.isUsed = false;
		}
	}

	function checkWin() {
		if (!puzzle) return;
		const won = puzzle.grid.every((row) =>
			row.every((cell) => !cell.isLetter || verifyChar(cell.value, cell.charHash))
		);
		if (won) {
			isComplete = true;

			const duration = 3 * 1000;
			const animationEnd = Date.now() + duration;
			const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

			const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

			const interval: any = setInterval(function () {
				const timeLeft = animationEnd - Date.now();

				if (timeLeft <= 0) {
					return clearInterval(interval);
				}

				const particleCount = 50 * (timeLeft / duration);
				confetti({
					...defaults,
					particleCount,
					origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
				});
				confetti({
					...defaults,
					particleCount,
					origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
				});
			}, 250);
		}
	}

	async function solvePuzzle() {
		if (!puzzle || isSolving || isComplete) return;
		isSolving = true;
		forfeitScore = true;
		score = 0;
		selectedUpper = null;
		selectedLower = null;

		const fullQuote = decode(puzzle.encodedQuote);
		const quoteChars = fullQuote.toUpperCase();

		const targetCells: { row: number; col: number; char: string }[] = [];
		let charIndex = 0;

		// Map quote chars to grid positions (re-simulate generation logic roughly)
		// Since the grid was built from the quote, we can iterate cells and match
		for (let r = 0; r < puzzle.height; r++) {
			for (let c = 0; c < puzzle.width; c++) {
				const cell = puzzle.grid[r][c];
				// We need the ACTUAL char for the solver to work
				// Since we don't store char in Cell, we'll re-derive it or find it in columns
				if (cell.isLetter && !verifyChar(cell.value, cell.charHash)) {
					// Find which char from the column matches this hash
					const charInCol = puzzle.columns[c].find((l) => verifyChar(l.char, cell.charHash));
					if (charInCol) {
						targetCells.push({ row: r, col: c, char: charInCol.char });
					}
				}
			}
		}

		targetCells.sort((a, b) => a.row - b.row || a.col - b.col);

		for (const target of targetCells) {
			const upIndex = puzzle.columns[target.col].findIndex(
				(l) => l.char === target.char && !l.isUsed
			);
			if (upIndex !== -1) {
				puzzle.columns[target.col][upIndex].isUsed = true;
				await new Promise((r) => setTimeout(r, 60));
				puzzle.grid[target.row][target.col].value = target.char;
			}
		}

		isSolving = false;
		checkWin();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!selectedLower || !puzzle || isSolving) return;

		const { row, col } = selectedLower;
		const char = e.key.toUpperCase();

		if (/[A-Z]/.test(char) && char.length === 1) {
			// Find if char is available in this column
			const index = puzzle.columns[col].findIndex((l) => l.char === char && !l.isUsed);
			if (index !== -1) {
				placeLetter(col, index, row, col);
			}
		} else if (e.key === 'Backspace' || e.key === 'Delete') {
			removeLetter(row, col);
		} else if (e.key === 'ArrowRight') {
			findNextEmptyCell(row, col);
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

<main class="relative flex min-h-screen flex-col items-center justify-center gap-8 p-4 md:p-8">
	<div class="absolute top-4 left-4 flex items-center gap-4 md:top-8 md:left-8">
		{#if !forfeitScore}
			<div
				class="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-2 backdrop-blur-sm"
				in:fade
			>
				<span class="block text-xs font-bold tracking-widest text-slate-500 uppercase">Score</span>
				<span class="text-xl font-bold text-sky-400 tabular-nums">{score}</span>
			</div>
		{:else}
			<div
				class="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 backdrop-blur-sm"
				in:fade
			>
				<span class="block text-xs font-bold tracking-widest text-rose-500 uppercase">Score</span>
				<span class="text-xl font-bold text-rose-500/50">FORFEIT</span>
			</div>
		{/if}
	</div>

	<div class="absolute top-4 right-4 md:top-8 md:right-8">
		<button
			class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:border-sky-500/50 hover:text-sky-400"
			onclick={() => (showInstructions = !showInstructions)}
			title="How to play"
		>
			<span class="text-xl font-bold">?</span>
		</button>
	</div>

	<div class="space-y-2 text-center">
		<h1
			class="bg-linear-to-br from-sky-400 via-indigo-400 to-purple-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent drop-shadow-2xl md:text-7xl"
		>
			Quotefall
		</h1>
		<p class="mx-auto max-w-lg text-lg leading-relaxed font-medium text-slate-400 md:text-xl">
			Reconstruct the hidden wisdom. Lower letters belong in the grid directly below.
		</p>
	</div>

	{#if showInstructions}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
			transition:fade
		>
			<div
				class="w-full max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl"
				in:scale={{ start: 0.9 }}
			>
				<h2 class="text-3xl font-bold text-white">How to Play</h2>
				<ul class="space-y-4 text-slate-300">
					<li class="flex gap-3">
						<span class="font-bold text-sky-400">1.</span>
						<span
							>Letters in the <strong>top grid</strong> belong in the column directly below them.</span
						>
					</li>
					<li class="flex gap-3">
						<span class="font-bold text-sky-400">2.</span>
						<span>Select a letter then a grid square to place it, or just type!</span>
					</li>
					<li class="flex gap-3">
						<span class="font-bold text-sky-400">3.</span>
						<span>Black squares are spaces. Punctuation is already filled in.</span>
					</li>
				</ul>
				<button
					class="w-full rounded-2xl bg-sky-50 py-4 font-bold text-slate-900 shadow-lg shadow-sky-500/20 transition-all hover:bg-white"
					onclick={() => (showInstructions = false)}
				>
					Got it!
				</button>

				<div class="border-t border-slate-800 pt-4 text-center">
					<p class="text-sm text-slate-500">
						Vibe coded by <a
							href="https://x.com/nickjmaietta"
							target="_blank"
							class="text-sky-400 transition-colors hover:text-sky-300">Nick Maietta</a
						>
					</p>
					<div class="mt-2 flex justify-center gap-4 text-xs font-medium text-slate-600">
						<a
							href="https://github.com/maietta/quotefall.com"
							target="_blank"
							class="transition-colors hover:text-slate-400">Source Code</a
						>
						<span>•</span>
						<a
							href="https://x.com/nickjmaietta"
							target="_blank"
							class="transition-colors hover:text-slate-400">@nickjmaietta</a
						>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if puzzle}
		{#key puzzle}
			<div class="flex flex-col gap-8" in:fade>
				<!-- Centered Container for Grids -->
				<div class="flex flex-col items-center">
					<!-- Upper Grid -->
					<div class="flex gap-1 md:gap-2">
						{#each puzzle.columns as col, colIdx (colIdx)}
							<div class="flex flex-col justify-end gap-1">
								{#each col as letter, letterIdx (letterIdx)}
									<div
										in:fly={{
											y: -1500,
											duration: 1200,
											delay: colIdx * 40 + letterIdx * 60,
											easing: cubicOut
										}}
									>
										<button
											class="flex h-8 w-6 transform items-center justify-center rounded-lg text-lg font-bold transition-all duration-300 md:h-12 md:w-10 md:text-2xl
												{letter.isUsed
												? 'pointer-events-none scale-75 cursor-default opacity-0'
												: 'border border-white/10 bg-slate-800/50 shadow-[0_0_15px_rgba(0,0,0,0.2)] backdrop-blur-sm hover:border-sky-500/50 hover:bg-slate-700/50'}
												{selectedUpper?.col === colIdx && selectedUpper?.index === letterIdx
												? 'z-10 scale-110 border-sky-400 ring-2 ring-sky-400'
												: ''}"
											onclick={() => handleUpperClick(colIdx, letterIdx)}
											aria-label="Letter {letter.char}"
										>
											{letter.char}
										</button>
									</div>
								{/each}
							</div>
						{/each}
					</div>

					<!-- Divider -->
					<div class="relative w-full py-6">
						<div
							class="h-px w-full bg-linear-to-r from-transparent via-slate-700 to-transparent"
						></div>
						<div class="absolute inset-0 flex items-center justify-center">
							<div
								class="bg-slate-900 px-4 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase"
							>
								Quote Structure Below
							</div>
						</div>
					</div>

					<!-- Lower Grid -->
					<div class="flex flex-col gap-1 md:gap-2">
						{#each puzzle.grid as row, rowIdx (rowIdx)}
							<div class="flex gap-1 md:gap-2">
								{#each row as cell, colIdx (colIdx)}
									<button
										class="flex h-8 w-6 items-center justify-center rounded-lg text-lg font-bold transition-all duration-300 md:h-12 md:w-10 md:text-2xl
											{cell.isSpace ? 'border border-transparent bg-slate-950/50' : 'border backdrop-blur-sm'}
											{cell.isPunctuation ? 'border-white/5 bg-slate-800/20 text-slate-500' : ''}
											{cell.isLetter ? 'cursor-pointer border-white/10 bg-slate-800/40 hover:border-sky-500/30' : ''}
											{selectedLower?.row === rowIdx && selectedLower?.col === colIdx
											? 'border-sky-400 bg-sky-900/20 ring-2 ring-sky-400'
											: ''}
											{cell.isLetter && cell.value ? 'border-sky-500/40 bg-sky-500/10 text-sky-100' : ''}
											{isComplete && cell.isLetter ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : ''}"
										onclick={() => handleLowerClick(rowIdx, colIdx)}
										aria-label="Grid cell"
									>
										{cell.value}
									</button>
								{/each}
							</div>
						{/each}
					</div>
				</div>

				{#if !isComplete}
					<div class="flex justify-center pt-4" in:fade>
						<button
							class="group flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/30 px-8 py-4 text-slate-400 transition-all hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-400 disabled:opacity-50"
							onclick={solvePuzzle}
							disabled={isSolving}
						>
							<span class="font-bold tracking-wide">Solve Puzzle</span>
							<span class="h-4 w-px bg-slate-700 transition-colors group-hover:bg-rose-500/30"
							></span>
							<span
								class="text-xs font-medium opacity-50 transition-opacity group-hover:opacity-100"
								>Forfeits Score</span
							>
						</button>
					</div>
				{/if}

				{#if isComplete}
					<div class="flex flex-col items-center gap-4" in:fly={{ y: 20 }}>
						<p class="text-2xl font-medium text-emerald-400">Puzzle Complete!</p>
						{#if decodedAuthor}
							<p class="text-slate-400">— {decodedAuthor}</p>
						{/if}
						<button
							class="mt-4 rounded-full bg-linear-to-r from-sky-500 to-indigo-500 px-8 py-3 font-bold shadow-xl shadow-sky-500/20 transition-transform hover:scale-105"
							onclick={initGame}
						>
							New Puzzle
						</button>
					</div>
				{/if}
			</div>
		{/key}
	{:else}
		<div class="flex animate-pulse flex-col items-center gap-4">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"
			></div>
			<p class="text-slate-400">Loading your puzzle...</p>
		</div>
	{/if}
</main>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
