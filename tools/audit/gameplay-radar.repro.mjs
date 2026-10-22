// Diagnóstico puro del HUD: DOM simulado, NO prueba visual ni WebGL.
import * as THREE from 'three';
import { createRadar } from '../../src/client/radar.js';
import { OBJECTIVE_PLAN } from '../../src/sim/data.js';
class Element {
  constructor() { this.children=[];this.style={};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};this.parts={}; }
  appendChild(x){this.children.push(x);}
  querySelector(x){return this.parts[x] ||= {style:{},textContent:''};}
}
globalThis.document={createElement:()=>new Element()};globalThis.innerWidth=844;globalThis.innerHeight=390;
const host=new Element(),radar=createRadar(host),camera=new THREE.PerspectiveCamera(80,844/390,.1,1000);
camera.updateMatrixWorld();
radar.update({left:2,boss:false,monsters:[{p:[-2,0,-30]},{p:[2,0,-40]}]},{pos:[0,0,0],dead:false},camera,[[-4,1,-26],[4,1,-36]]);
const visible=host.children[0].children.filter(a=>a.style.display!=='none');
console.log(JSON.stringify({fixture:'2 enemigos reales + 2 ecos falsos de niebla',visibleMarkers:visible.length,markedAsLast:visible.filter(a=>a.classes.has('ult')).length,distances:visible.map(a=>a.querySelector('span').textContent),objectivePlans:OBJECTIVE_PLAN},null,2));
