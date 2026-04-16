<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		key: string;
		text: string;
		position?: 'top' | 'bottom';
	};

	const { key, text, position = 'top' }: Props = $props();

	let visible = $state(false);

	onMount(() => {
		const dismissed = localStorage.getItem(`tooltip-${key}`);
		if (!dismissed) {
			visible = true;
		}
	});

	function dismiss() {
		visible = false;
		localStorage.setItem(`tooltip-${key}`, '1');
	}
</script>

{#if visible}
	<button class="tooltip tooltip-{position}" onclick={dismiss} aria-label="Dismiss hint">
		<span class="tooltip-text">{text}</span>
		<span class="tooltip-dismiss">x</span>
	</button>
{/if}

<style>
	.tooltip {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		background: #0a0a18;
		border: 1px solid #4488ff;
		color: #ccc;
		font-family: monospace;
		font-size: 13px;
		cursor: pointer;
		z-index: 100;
		white-space: nowrap;
		box-shadow: 0 0 12px rgba(68, 136, 255, 0.2);
		animation: tooltipFadeIn 0.4s ease-out;
	}

	.tooltip-top {
		top: 12px;
	}

	.tooltip-bottom {
		bottom: 12px;
	}

	.tooltip-text {
		color: #aac8ff;
	}

	.tooltip-dismiss {
		color: #555;
		font-size: 14px;
		margin-left: 4px;
	}

	.tooltip:hover {
		background: #111128;
		border-color: #66aaff;
	}

	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
