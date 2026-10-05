export const GestureDetector = ({ children }: { children: unknown }) => children;
export const Gesture = {
  Pan: () => {
    const chain: Record<string, unknown> = {};
    const add = () => chain;
    chain.enabled = () => add();
    chain.activeOffsetX = () => add();
    chain.failOffsetY = () => add();
    chain.onUpdate = () => add();
    chain.onEnd = () => add();
    return chain;
  },
};

export default { Gesture, GestureDetector };