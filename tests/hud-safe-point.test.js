import test from 'node:test';
import assert from 'node:assert/strict';
import { hudSafePoint } from '../src/client/hud-safe-point.js';
test('offscreen markers avoid health and action panels on desktop and mobile', () => {
  for (const [w,h] of [[1280,800],[844,390],[667,375]]) {
    for (const [x,y] of [[w-40,h-60],[50,h-50],[w-60,h-180]]) {
      const [a,b] = hudSafePoint(x,y,w,h);
      assert.ok(a >= 24 && a <= w-24 && b >= 24 && b <= h-24);
      assert.ok(!(a > w-230 && b > h-255));
      assert.ok(!(a < 260 && b > h-125));
    }
    assert.deepEqual(hudSafePoint(w/2,50,w,h),[w/2,50]);
  }
});
