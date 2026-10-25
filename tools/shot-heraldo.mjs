import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const s=await startServer({port:0}), b=await launch();
try {
const p=await b.newPage({viewport:{width:900,height:900}});
p.on('pageerror', e=>console.log('ERROR',e.message));
await p.goto(`http://localhost:${s.port}/fauna-arte.html`);
await p.evaluate(async()=>{
 const THREE=await import('three'), {kit}=await import('/src/client/organism.js'), {default:build}=await import('/src/client/creatures/heraldo.js');
 document.body.innerHTML='<canvas id="preview"></canvas>';
 const r=new THREE.WebGLRenderer({canvas:document.querySelector('#preview'),antialias:true});r.setSize(900,900);r.setPixelRatio(1);
 const sc=new THREE.Scene();sc.background=new THREE.Color(0x101322);
 const cam=new THREE.PerspectiveCamera(35,1,.1,100);cam.position.set(0,.1,6.8);cam.lookAt(0,-.3,0);
 sc.add(new THREE.HemisphereLight(0xb9eeff,0x462135,2.8)); const light=new THREE.DirectionalLight(0xffddbc,3);light.position.set(-3,4,5);sc.add(light);
 const h=build(kit);sc.add(h.root);h.tick(.016,{talk:.4},2,{look:new THREE.Vector3(0,0,1)});r.render(sc,cam);
 window.__heraldoInfo={calls:r.info.render.calls,triangles:r.info.render.triangles};
});
await p.screenshot({path:'shots/heraldo-custodio.png'});console.log(await p.evaluate(()=>window.__heraldoInfo));
}finally{await b.close();await s.close();}
