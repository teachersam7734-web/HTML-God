// mkglb.mjs: build a 29,161-vertex test mesh and write raw.glb, meshopt.glb and draco.glb with glTF-Transform (MIT).
//   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer draco3dgltf
//   node mkglb.mjs        (writes into the current folder)
// verified: Windows 10, Node 24, @gltf-transform 4.5.1, meshoptimizer 1.3.0, draco3dgltf 1.5.9: raw 1,625,260 bytes,
//           meshopt 256,596, Draco 94,604 (3D lane; rerun here, same sizes); both loaded offline in examples/glb.html.
// not verified: the @gltf-transform/cli command line (the API is used instead); textures (this mesh has none).
// Copied from code-3d/mkglb.mjs in the HTML-Sensei build project's research notes (not shipped) (original code of this project).
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { meshopt, draco, quantize, weld, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import fs from 'fs';
function build(){
  const doc=new Document(); const buf=doc.createBuffer();
  const nu=240,nv=120,pos=[],nor=[],uv=[],idx=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){ const u=i/nu*Math.PI*2,v=j/nv*Math.PI*2;
    const R=1+.35*Math.sin(3*u+v), r=.3; const x=(R+r*Math.cos(v))*Math.cos(u), y=(R+r*Math.cos(v))*Math.sin(u), z=r*Math.sin(v)+.2*Math.sin(5*u);
    pos.push(x,y,z); nor.push(Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u),Math.sin(v)); uv.push(i/nu,j/nv); }
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){ const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1; idx.push(a,c,b,b,c,d); }
  const P=doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf);
  const N=doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buf);
  const U=doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buf);
  const I=doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf);
  const prim=doc.createPrimitive().setAttribute('POSITION',P).setAttribute('NORMAL',N).setAttribute('TEXCOORD_0',U).setIndices(I);
  const mesh=doc.createMesh('m').addPrimitive(prim); const node=doc.createNode('n').setMesh(mesh); doc.createScene().addChild(node); return doc; }
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const out=(n,b)=>{fs.writeFileSync(n,b);console.log(n,b.length)};
const io0=new NodeIO(); out('raw.glb', await io0.writeBinary(build()));
{ const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const d=build(); await d.transform(weld(),quantize(),meshopt({encoder:MeshoptEncoder,level:'high'})); out('meshopt.glb', await io.writeBinary(d)); }
{ const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.encoder':await draco3d.createEncoderModule(),'draco3d.decoder':await draco3d.createDecoderModule()});
  const d=build(); await d.transform(draco()); out('draco.glb', await io.writeBinary(d)); }
