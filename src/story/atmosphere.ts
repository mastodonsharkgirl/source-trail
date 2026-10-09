import * as THREE from "three";
export function mountAtmosphere(
  host: HTMLElement,
  paused: () => boolean,
  mood: () => string,
) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
  } catch {
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  host.append(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.Camera();
  let lost = false;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { time: { value: 0 }, night: { value: 0 } },
    vertexShader:
      "varying vec2 uvp;void main(){uvp=uv;gl_Position=vec4(position,1.);}",
    fragmentShader: `precision mediump float;varying vec2 uvp;uniform float time;uniform float night;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){vec2 p=uvp;float curve=.18+pow((p.x-.5)*1.1,2.);float rim=exp(-abs(p.y-curve)*100.);float glow=exp(-abs(p.y-curve)*12.);float cloud=sin(p.x*14.+time*.03)+sin(p.x*25.-time*.02+p.y*12.);float haze=smoothstep(.5,1.8,cloud)*exp(-abs(p.y-.45)*7.);vec2 cell=floor(p*vec2(190.,85.));float star=step(.996,hash(cell))*pow(max(0.,1.-length(fract(p*vec2(190.,85.))-.5)*2.),5.)*step(curve+.1,p.y);vec3 col=vec3(.2,.75,.8)*glow*.28+vec3(.8,.96,1.)*rim*.4+vec3(.8,.86,.88)*haze*.08+vec3(1.)*star*(.3+night);gl_FragColor=vec4(col,clamp(glow*.4+haze*.1+star,0.,.7));}`,
  });
  const geo = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geo, material));
  const resize = () => {
    renderer.setSize(
      Math.min(host.clientWidth, 1600),
      Math.min(host.clientHeight, 900),
      false,
    );
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  let frame = 0,
    last = 0,
    visibleTime = 0;
  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    if (paused() || lost) {
      last = now;
      return;
    }
    if (now - last < 40) return;
    visibleTime += Math.min(now - last, 50);
    last = now;
    material.uniforms.time!.value = visibleTime / 1000;
    material.uniforms.night!.value = mood() === "night" ? 1 : 0;
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(tick);
  const onLoss = (event: Event) => {
    event.preventDefault();
    lost = true;
    renderer.domElement.style.display = "none";
  };
  renderer.domElement.addEventListener("webglcontextlost", onLoss);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.domElement.removeEventListener("webglcontextlost", onLoss);
    geo.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
