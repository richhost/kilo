import type { MotionProps } from 'gpuix-svelte';

/** Strong ease-out. GPUI ignores CSS transitions, so the curve lives on `motion`. */
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export const fadeMotion = (opacity: number, duration: number): MotionProps => ({
	initial: { opacity: 0 },
	animate: { opacity },
	transition: { duration, ease: EASE_OUT }
});

export const dropdownMotion = (open: boolean, offsetY = -4): MotionProps => ({
	initial: { opacity: 0, top: offsetY },
	animate: open ? { opacity: 1, top: 0 } : { opacity: 0, top: offsetY },
	transition: { duration: open ? 0.15 : 0.1, ease: EASE_OUT }
});

export const dialogMotion = (open: boolean): MotionProps => ({
	initial: { opacity: 0 },
	animate: { opacity: open ? 1 : 0 },
	transition: { duration: open ? 0.2 : 0.14, ease: EASE_OUT }
});

export const menuMotion = (open: boolean): MotionProps => ({
	initial: { opacity: 0, top: -3 },
	animate: open ? { opacity: 1, top: 0 } : { opacity: 0, top: -3 },
	transition: { duration: open ? 0.11 : 0.08, ease: EASE_OUT }
});

export const toastMotion = (leaving: boolean, fromTop = false): MotionProps => {
	const dy = fromTop ? -8 : 8;
	return {
		initial: { opacity: 0, top: dy },
		animate: leaving ? { opacity: 0, top: dy } : { opacity: 1, top: 0 },
		transition: { duration: leaving ? 0.14 : 0.22, ease: EASE_OUT }
	};
};

export const segmentMotion = (left: number, width: number): MotionProps => ({
	initial: false,
	animate: { left, width },
	transition: { duration: 0.18, ease: EASE_OUT }
});
