<script lang="ts">
	type Props = {
		/** 0–1 progress value */
		progress?: number;
		/** Status text shown below the bar */
		status?: string;
		/** Whether loading is complete (hides after transition) */
		done?: boolean;
	};

	let { progress = 0, status = 'Loading...', done = false }: Props = $props();
</script>

{#if !done}
	<div class="loading-screen" class:fade-out={done}>
		<div class="loading-content">
			<h1 class="loading-title">RHYTHM GAME</h1>

			<div class="progress-track">
				<div
					class="progress-fill"
					style="width: {Math.round(progress * 100)}%"
				></div>
			</div>

			<p class="loading-status">{status}</p>

			<div class="loading-dots">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
			</div>
		</div>
	</div>
{/if}

<style>
	.loading-screen {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0a0a0f;
		transition: opacity 0.4s ease-out;
	}

	.loading-screen.fade-out {
		opacity: 0;
		pointer-events: none;
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		width: 320px;
	}

	.loading-title {
		font-family: monospace;
		font-size: 36px;
		letter-spacing: 6px;
		color: #4488ff;
		margin: 0;
		animation: titlePulse 2.5s ease-in-out infinite;
	}

	@keyframes titlePulse {
		0%, 100% {
			text-shadow:
				0 0 10px rgba(68, 136, 255, 0.3),
				0 0 30px rgba(68, 136, 255, 0.1);
			opacity: 0.9;
		}
		50% {
			text-shadow:
				0 0 20px rgba(68, 136, 255, 0.6),
				0 0 50px rgba(68, 136, 255, 0.2),
				0 0 80px rgba(68, 136, 255, 0.1);
			opacity: 1;
		}
	}

	.progress-track {
		width: 100%;
		height: 4px;
		background: rgba(68, 136, 255, 0.15);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #4488ff;
		border-radius: 2px;
		transition: width 0.2s ease-out;
		box-shadow: 0 0 8px rgba(68, 136, 255, 0.5);
	}

	.loading-status {
		font-family: monospace;
		font-size: 13px;
		color: #888;
		letter-spacing: 1px;
		margin: 0;
	}

	.loading-dots {
		display: flex;
		gap: 8px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #4488ff;
		animation: dotBounce 1.2s ease-in-out infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.15s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes dotBounce {
		0%, 80%, 100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1.2);
		}
	}
</style>
