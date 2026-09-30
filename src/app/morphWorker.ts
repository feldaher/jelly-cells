// Builds morph keyframes off the main thread.

import { buildKeyframe, type MorphRequest } from './morph';

self.onmessage = (e: MessageEvent<{ id: number; req: MorphRequest }>) => {
  const { id, req } = e.data;
  const kf = buildKeyframe(req);
  (self as unknown as Worker).postMessage({ id, kf });
};
