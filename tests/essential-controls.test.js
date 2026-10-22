import test from 'node:test';
import assert from 'node:assert/strict';
import { essentialActions, thirdForMode } from '../src/client/essential-controls.js';
import { TouchControls } from '../src/client/touch.js';
import { settings, DEFAULTS } from '../src/client/settings.js';
import { metaActual } from '../src/client/meta-texto.js';
import { createRadar } from '../src/client/radar.js';
import * as THREE from 'three';

// DOM fixture: verifies visibility policy and input, not browser layout or WebGL.
class Element {
  constructor() { this.children=[]; this.style={setProperty(){}}; this.classes=new Set(); this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)}; this.parts={}; }
  appendChild(x){this.children.push(x);}
  querySelector(x){return this.parts[x] ||= new Element();}
}
globalThis.document={createElement:()=>new Element(),body:new Element()};
globalThis.innerWidth=844; globalThis.innerHeight=390;

test('four combat actions in both modes, interaction replaces power, pause remains accessible', () => {
  for (const mode of ['shooter','combo']) for (const use of [false,true]) {
    const actions=essentialActions(mode,{use,ult:true,evo:true});
    assert.equal(actions.filter(x=>x!=='pause').length,4);
    for (const x of ['fire','jump','mode','pause']) assert.ok(actions.includes(x));
    assert.ok(actions.includes(use?'use':mode==='combo'?'s3':'esp'));
  }
  assert.equal(thirdForMode('shooter'),false);
  assert.equal(thirdForMode('combo'),true);
  assert.equal(DEFAULTS.simple,false,'manual attack is the default');
});

test('TouchControls applies essentials and restores complete actions in both modes', () => {
  const t=Object.create(TouchControls.prototype), elements=new Map();
  Object.assign(t,{host:new Element(),ctx:{},editing:false,relabel(){},$:s=>{if(!elements.has(s)) elements.set(s,new Element());return elements.get(s);}});
  const visible=id=>!t.$(`[data-a="${id}"]`).classes.has('tc-off');
  for (const mode of ['shooter','combo']) {
    t.mode=mode; settings().advanced=false; t.applyLayout();
    assert.ok(visible(mode==='combo'?'s3':'esp')); assert.ok(!visible('reload')); assert.ok(!visible('ult'));
    t.st={esp:true,s3:true,use:false}; t.setContext({use:true});
    assert.ok(visible('use')); assert.ok(!visible('esp')); assert.ok(!visible('s3'));
    assert.equal(t.st.esp,false); assert.equal(t.st.s3,false);
    settings().advanced=true; t.applyLayout();
    for(const id of ['mov','esp','s3','reload','use']) assert.ok(visible(id),id);
    t.ctx={};
  }
  settings().advanced=false;
});

test('manual touch attack never fires without input, melee routes primary attack', () => {
  const t=Object.create(TouchControls.prototype);
  Object.assign(t,{st:{},mode:'shooter',mx:0,mz:0,dyaw:0,dpitch:0,weapon:-1});
  assert.ok(!t.read().fire); t.st.fire=true; assert.equal(t.read().fire,true);
  t.mode='combo'; const input=t.read(); assert.equal(input.fire,false); assert.equal(input.a1,true);
});

test('last enemies: radar never presents fog echoes as remaining targets', () => {
  const host=new Element(), radar=createRadar(host), camera=new THREE.PerspectiveCamera(80,844/390,.1,1000);
  camera.updateMatrixWorld();
  const state={left:2,boss:false,monsters:[{p:[-2,0,-30]},{p:[2,0,-40]}]};
  radar.update(state,{pos:[0,0,0],dead:false},camera,[[-4,1,-26],[4,1,-36]]);
  const visible=host.children[0].children.filter(x=>x.style.display!=='none');
  assert.equal(visible.length,2); assert.ok(visible.every(x=>x.classes.has('ult')));
  radar.update(null,null,camera); assert.ok(host.children[0].children.every(x=>x.style.display==='none'));
});

test('primary goal gives solo/cooperative plate instructions and deadline', () => {
  const state={state:'playing',phase:'wave',wave:2,waveTotal:8,left:2,players:[{}],obj:{state:'active',type:'sintonia',prog:.5,left:48}};
  assert.match(metaActual(state,{}).main,/cada placa/);
  assert.match(metaActual(state,{}).next,/48 s/);
  state.players.push({}); assert.match(metaActual(state,{}).main,/a la vez/);
});
