// Bake the actual low-quality gameplay bodies once, avoiding another WebGL context on phones.
import fs from 'node:fs';import {chromium} from 'playwright-core';import {startServer} from '../server/server.js';
const server=await startServer({port:0,silencio:true});let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:192,height:192}});
 await page.route('**/portrait-render',r=>r.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#101925}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three-addons/"}}</script><canvas id="portrait"></canvas>'}));
 await page.goto(`http://localhost:${server.port}/portrait-render`);
 await page.evaluate(async()=>{
  const T=await import('three'),hm=await import('/src/client/humans.js'),mod=await import('/src/client/huesped-cuerpo.js');
  const kit=await hm.loadHumanKit({quality:'low',movil:true});const gl=new T.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});gl.setSize(192,192);gl.setClearColor(0x101925);gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.5;
  const scene=new T.Scene(),cam=new T.PerspectiveCamera(30,1,.1,50);scene.add(new T.HemisphereLight(0xe5efff,0x303045,2.5));const key=new T.DirectionalLight(0xfff0dc,3);key.position.set(2,4,4);scene.add(key);const rim=new T.DirectionalLight(0x80dfff,2);rim.position.set(-3,2,-2);scene.add(rim);
  window.drawHost=async id=>{if(window.body3d){scene.remove(window.body3d.object);window.body3d.dispose();}const b=mod.createHostBody(T,kit,{char:id,name:id,evo:0,pth:[],cg:[],mr:1},{quality:'low',camera:cam,map:'m1'});await b.ready;window.body3d=b;scene.add(b.object);b.object.rotation.y=-.25;cam.position.set(0,1.8,2.2);cam.lookAt(0,1.65,0);gl.render(scene,cam);};
 });
 fs.mkdirSync('public/portraits',{recursive:true});for(const id of ['axioma','vesper','micelio','umbra','seraf','colmena','danzante','singular']){await page.evaluate(id=>window.drawHost(id),id);await page.locator('canvas').screenshot({path:`public/portraits/${id}.png`});console.log(id);}
}finally{if(browser)await browser.close();await server.close();}
