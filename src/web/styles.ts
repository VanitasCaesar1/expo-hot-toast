/**
 * The DOM build's base stylesheet. Layout and motion live here; colours, sizes
 * and durations come from the theme tokens as inline styles and CSS variables,
 * so a token means the same on the web as on a phone. The Toaster renders it
 * as a React 19 hoisted `<style>`, deduplicated by `href`, so it works with
 * server rendering and needs no CSS import.
 */
export const STYLE_ID = 'expo-hot-toast';

export const css = /* css */ `
.eht-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}
.eht-stack {
  position: absolute;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.eht-item {
  width: 100%;
  display: grid;
  grid-template-rows: 1fr;
  pointer-events: none;
  transition: grid-template-rows var(--eht-shift, 300ms) var(--eht-enter-ease, ease), margin var(--eht-shift, 300ms) var(--eht-enter-ease, ease);
}
/* Entering and leaving, a toast's row grows from and shrinks to nothing, so
   its neighbours slide instead of jumping. */
.eht-item[data-state='entering'],
.eht-item[data-state='leaving'] {
  grid-template-rows: 0fr;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}
.eht-item > .eht-clip {
  min-height: 0;
  display: flex;
  overflow: visible;
}
.eht-motion {
  display: flex;
  /* Never stretched: the toast keeps its own height while its row grows from
     nothing, or its size is measured as nothing. */
  align-items: flex-start;
  width: 100%;
  transform: translate3d(0, 0, 0) scale(1);
  opacity: 1;
  transition:
    transform var(--eht-enter, 350ms) var(--eht-enter-ease, ease),
    opacity var(--eht-enter, 350ms) var(--eht-enter-ease, ease);
  will-change: transform, opacity;
}
.eht-item[data-state='entering'] .eht-motion {
  transform: translate3d(0, var(--eht-from-y, -60%), 0) scale(var(--eht-from-scale, 0.6));
  opacity: 0;
  transition: none;
}
.eht-item[data-state='leaving'] .eht-motion {
  transform: translate3d(var(--eht-drag-x, 0px), calc(var(--eht-to-y, -60%) + var(--eht-drag-y, 0px)), 0) scale(var(--eht-to-scale, 0.6));
  opacity: 0;
  transition:
    transform var(--eht-exit, 400ms) var(--eht-exit-ease, ease),
    opacity var(--eht-exit, 400ms) var(--eht-exit-ease, ease);
}
.eht-toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  flex: none;
  box-sizing: border-box;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
  overflow: hidden;
  font-family: var(--eht-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
  transition: width var(--eht-morph, 260ms) var(--eht-enter-ease, ease), height var(--eht-morph, 260ms) var(--eht-enter-ease, ease);
}
.eht-toast[data-dragging] {
  transition: none;
  cursor: grabbing;
}
.eht-toast[data-pressable] {
  cursor: pointer;
}
.eht-content {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: max-content;
  min-width: 0;
  /* Laid out at its own size, never squeezed to the surface's: the surface
     takes the content's measured size, not the other way round. */
  flex: none;
}
.eht-content[data-fill] {
  width: 100%;
}
.eht-row {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1 1 auto;
}
.eht-hud {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0;
  text-align: center;
}
.eht-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}
.eht-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.eht-icon[data-pop] {
  animation: eht-pop var(--eht-icon-pop, 350ms) var(--eht-icon-ease, ease) var(--eht-icon-delay, 0ms) both;
}
.eht-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.eht-title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.eht-hud .eht-title-line {
  justify-content: center;
}
.eht-title,
.eht-description {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}
.eht-timestamp {
  flex: none;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.eht-button {
  appearance: none;
  border: 0;
  margin: 0 0 0 2px;
  padding: 4px 0;
  background: transparent;
  font: inherit;
  font-weight: 600;
  line-height: 1.3;
  border-radius: 999px;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
}
.eht-button:active {
  opacity: 0.55;
}
.eht-button:focus-visible,
.eht-close:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.eht-close {
  appearance: none;
  border: 0;
  padding: 0;
  margin: 0 0 0 2px;
  width: 30px;
  height: 30px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
}
.eht-close:active {
  opacity: 0.5;
}
.eht-hud-buttons {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.eht-expanded {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid;
  animation: eht-fade-in 220ms ease-out both;
}
.eht-chevron {
  transition: transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.eht-badge {
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin-left: 6px;
  flex: none;
}
.eht-avatar {
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(127, 127, 127, 0.18);
  flex: none;
}
.eht-avatar > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.eht-percent {
  flex: none;
  min-width: 38px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.eht-bar {
  display: flex;
  gap: 4px;
  align-self: stretch;
  margin-top: 8px;
}
.eht-track {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  pointer-events: none;
}
.eht-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  transform-origin: left center;
  transform: scaleX(0);
  transition: transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.eht-track[data-current]::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: currentColor;
  animation: eht-pulse 1100ms ease-in-out infinite alternate;
}
.eht-bar[data-indeterminate] .eht-fill {
  width: 34%;
  right: auto;
  transform: none;
  animation: eht-sweep 1300ms cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
}
.eht-ring-arc {
  transition: stroke-dashoffset 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.eht-ring[data-indeterminate] {
  animation: eht-spin 1300ms linear infinite;
}
.eht-spinner {
  animation: eht-spin 800ms linear infinite;
}
.eht-draw {
  stroke-dashoffset: var(--eht-length);
  animation: eht-draw 200ms cubic-bezier(0, 0, 0.58, 1) 200ms forwards;
}
.eht-mark {
  transform-origin: 12px 12px;
  animation: eht-mark 200ms ease-out 150ms both;
}
.eht-countdown-arc {
  transform-origin: 50% 50%;
  transform: rotate(-90deg);
}

@keyframes eht-pop {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes eht-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes eht-mark {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes eht-spin {
  to { transform: rotate(360deg); }
}
@keyframes eht-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
}
@keyframes eht-pulse {
  from { opacity: 0.16; }
  to { opacity: 0.5; }
}
@keyframes eht-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes eht-countdown {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: var(--eht-circumference); }
}

/* A collapsed stack shows only the edges of the toasts behind the front one. */
.eht-item[data-tucked] .eht-content {
  opacity: 0;
}
.eht-content {
  transition: opacity 200ms ease;
}

/* Reduce Motion: toasts fade where they sit, and glyphs arrive finished. */
@media (prefers-reduced-motion: reduce) {
  .eht-item[data-state='entering'] .eht-motion,
  .eht-item[data-state='leaving'] .eht-motion {
    transform: none;
  }
  .eht-item,
  .eht-toast {
    transition-duration: 0ms;
  }
  .eht-icon[data-pop],
  .eht-draw,
  .eht-mark,
  .eht-expanded {
    animation: none;
  }
  .eht-draw {
    stroke-dashoffset: 0;
  }
  .eht-bar[data-indeterminate] .eht-fill,
  .eht-ring[data-indeterminate] {
    animation-duration: 3000ms;
  }
  .eht-track[data-current]::before {
    animation: none;
    opacity: 0.35;
  }
}
`;
