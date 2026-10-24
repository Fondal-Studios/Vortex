import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('public/sw.js', 'utf8');
for (const path of ['/Vortex/', '/Vortex/public/focused-hud.css?v=weapons-top-2', '/Vortex/src/client/touch.js', '/Vortex/assets/map.png']) {
  test(`service worker revalidates code: ${path}`, async () => {
    const handlers = {}; let options;
    const response = {ok:true, type:'basic', clone(){return this;}};
    vm.runInNewContext(source, {URL, location:{origin:'https://game.test'}, self:{addEventListener:(name,fn)=>handlers[name]=fn}, caches:{open:async()=>({put(){}})}, fetch:async (_request, opts)=>{options=opts;return response;}});
    let pending;
    handlers.fetch({request:{url:`https://game.test${path}`, method:'GET', mode:path.endsWith('/')?'navigate':'cors'}, respondWith(value){pending=value;}});
    assert.equal(await pending,response);
    assert.equal(options.cache, path.endsWith('.png') ? undefined : 'no-cache');
  });
}
test('HUD stylesheet URL bypasses the previously cached file', () => {
  assert.match(fs.readFileSync('public/index.html','utf8'), /focused-hud\.css\?v=weapons-top-2/);
});
