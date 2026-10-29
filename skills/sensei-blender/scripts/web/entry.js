// entry.js: the three.js subset the GLB player needs, bundled by build_html.mjs into one IIFE (global GLBDEMO).
// verified: bundled with esbuild 0.28.2 against three 0.186.1 and run in the player (scripts/web/test-web.mjs).
// not verified: other three releases (InlineDRACOLoader overrides a private method, _loadLibrary: re-run the test
//               after any upgrade).
// Copied from blender-demo/web/entry.js in the HTML-Sensei build project's research notes (not shipped) (original to this project). three.js is MIT.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Timer, Box3, Vector3, AnimationMixer, LoopRepeat,
  DirectionalLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace,
} from 'three';
import { DRACOLoader as _DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Offline Draco: DRACOLoader normally fetch()es draco_wasm_wrapper.js and draco_decoder.wasm by URL.
// This subclass serves them from memory instead (a string and an ArrayBuffer put on the page by the build script).
export class InlineDRACOLoader extends _DRACOLoader {
  constructor(manager, libs) { super(manager); this._libs = libs; }
  _loadLibrary(url, responseType) {
    const key = /\.wasm$/.test(url) ? 'wasm' : /wrapper/.test(url) ? 'wrapper' : 'js';
    return Promise.resolve(this._libs[key]);
  }
}
