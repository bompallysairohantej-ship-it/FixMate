import { Suspense, useRef, useEffect, useState, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox, ContactShadows, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const pale = '#d7e0da',
  dark = '#17241e',
  green = '#29df76';
function Box({ args = [1, 1, 1], color = pale, ...props }) {
  return (
    <RoundedBox args={args} radius={0.045} smoothness={3} {...props}>
      <meshStandardMaterial color={color} metalness={0.48} roughness={0.3} />
    </RoundedBox>
  );
}
function Washer({ exploded = 0, labels = false }) {
  return (
    <group>
      <Box args={[1.65, 2, 1.35]} position={[0, 0, -exploded * 0.7]} />
      <Box args={[1.55, 0.3, 0.1]} color="#f5faf7" position={[0, 0.77, 0.72 + exploded * 0.4]} />
      <Box args={[0.48, 0.11, 0.03]} color={dark} position={[-0.33, 0.78, 0.79 + exploded * 0.4]} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.45, 0.77, 0.8 + exploded * 0.4]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 24]} />
        <meshStandardMaterial color="#43554a" metalness={0.8} roughness={0.2} />
      </mesh>
      <group position={[0, -0.13, 0.72 + exploded * 1.1]}>
        <mesh>
          <torusGeometry args={[0.53, 0.085, 16, 64]} />
          <meshStandardMaterial color="#647c6b" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.46, 0.46, 0.04, 64]} />
          <meshStandardMaterial color="#12251d" metalness={0.6} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <torusGeometry args={[0.38, 0.012, 8, 64]} />
          <meshStandardMaterial color={green} emissive={green} emissiveIntensity={0.4} />
        </mesh>
      </group>
      {exploded > 0.02 && (
        <>
          <Box args={[0.55, 0.4, 0.45]} color="#263d30" position={[0, -0.85, -0.1 - exploded]} />
          <Box
            args={[0.15, 0.3, 0.3]}
            color="#f04452"
            position={[0.6, 0.4, -0.5 - exploded * 0.8]}
          />
        </>
      )}
      {labels && (
        <>
          <Html position={[-1.2, 0.8, 1]} center>
            <span className="component-label">Control panel</span>
          </Html>
          <Html position={[1.1, -0.15, 1.8]} center>
            <span className="component-label">Drum assembly</span>
          </Html>
          <Html position={[-1, -0.9, 0]} center>
            <span className="component-label red">Motor · illustrative</span>
          </Html>
        </>
      )}
      <Box args={[1.5, 0.08, 0.15]} color="#b7c8bc" position={[0, -0.85, 0.71]} />
    </group>
  );
}
function Fridge() {
  return (
    <group>
      <Box args={[1.15, 2.3, 1.05]} color="#a1b6a7" />
      <Box args={[1.09, 0.74, 0.06]} position={[0, 0.73, 0.55]} />
      <Box args={[1.09, 1.39, 0.06]} position={[0, -0.39, 0.55]} />
      <Box args={[0.055, 0.3, 0.06]} color={dark} position={[0.41, 0.7, 0.61]} />
      <Box args={[0.055, 0.5, 0.06]} color={dark} position={[0.41, 0.05, 0.61]} />
    </group>
  );
}
function Microwave() {
  return (
    <group>
      <Box args={[1.5, 0.85, 0.9]} />
      <Box args={[1.06, 0.62, 0.03]} color={dark} position={[-0.12, 0, 0.47]} />
      <Box args={[0.1, 0.3, 0.05]} color="#667e6d" position={[0.33, 0, 0.5]} />
      <Box args={[0.15, 0.08, 0.04]} color={green} position={[0.59, 0.17, 0.48]} />
    </group>
  );
}
function AC() {
  return (
    <group>
      <Box args={[1.9, 0.65, 0.6]} />
      <Box args={[1.65, 0.06, 0.06]} color={dark} position={[0, -0.18, 0.32]} />
      <Box args={[0.15, 0.035, 0.02]} color={green} position={[0.63, 0.1, 0.32]} />
    </group>
  );
}
function TV() {
  return (
    <group>
      <Box args={[1.7, 1, 0.12]} color="#19241c" />
      <Box args={[1.55, 0.85, 0.02]} color="#345845" position={[0, 0, 0.075]} />
      <Box args={[0.1, 0.3, 0.1]} position={[0, -0.6, 0]} />
      <Box args={[0.65, 0.05, 0.3]} position={[0, -0.75, 0]} />
    </group>
  );
}
function Scene({ explorer, reduced }) {
  const group = useRef();
  const washer = useRef();
  const [explode, setExplode] = useState(0);
  useEffect(() => {
    if (!explorer || reduced) return;
    const state = { progress: 0 };
    const tween = gsap.to(state, {
      progress: 1,
      ease: 'none',
      scrollTrigger: { trigger: '#explorer', start: 'top 75%', end: 'bottom 20%', scrub: 0.8 },
      onUpdate: () => setExplode(Math.sin(state.progress * Math.PI)),
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [explorer, reduced]);
  useFrame((state, delta) => {
    if (!reduced && group.current && !explorer) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        state.pointer.x * 0.16,
        0.035
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        -state.pointer.y * 0.08,
        0.035
      );
    }
    if (explorer && washer.current && !reduced) {
      washer.current.rotation.y = -0.3 + explode * 0.7;
      state.camera.position.z = THREE.MathUtils.lerp(
        state.camera.position.z,
        7 - explode * 0.7,
        0.05
      );
    }
  });
  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[3, 6, 5]} intensity={3} color="#eaffef" />
      <pointLight position={[-3, 0, 2]} intensity={15} color={green} />
      <pointLight position={[4, -1, -2]} intensity={10} color="#f04452" />
      <group ref={group} rotation={[0.06, -0.27, 0]}>
        {explorer ? (
          <group ref={washer} position={[0, 0.1, 0]}>
            <Washer exploded={explode} labels={explode > 0.55} />
          </group>
        ) : (
          <>
            <Float speed={reduced ? 0 : 1.5} rotationIntensity={0.08} floatIntensity={0.22}>
              <group position={[-0.15, -0.15, 0.65]} rotation={[0, 0.1, -0.04]}>
                <Washer />
              </group>
            </Float>
            <Float speed={reduced ? 0 : 1.1} rotationIntensity={0.07} floatIntensity={0.3}>
              <group position={[1.45, 0.55, -0.8]} scale={0.83} rotation={[0, -0.13, 0.06]}>
                <Fridge />
              </group>
            </Float>
            <Float speed={reduced ? 0 : 1.4} floatIntensity={0.2}>
              <group position={[-1.65, 1.35, -0.55]} scale={0.7} rotation={[0, 0.2, -0.12]}>
                <AC />
              </group>
            </Float>
            <Float speed={reduced ? 0 : 1.3} floatIntensity={0.2}>
              <group position={[-1.75, -1.05, -0.1]} scale={0.7} rotation={[0, 0.25, 0.06]}>
                <Microwave />
              </group>
            </Float>
            <group position={[1.9, -1.1, 0.5]} scale={0.5} rotation={[0, -0.2, 0.1]}>
              <TV />
            </group>
          </>
        )}
      </group>
      <ContactShadows
        position={[0, -1.6, 0]}
        opacity={0.45}
        scale={10}
        blur={2.5}
        far={5}
        color="#0b2f1b"
      />
      {explorer && (
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={0.7} maxPolarAngle={2} />
      )}
    </>
  );
}
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        <img src="/favicon.svg" alt="FixMate appliance services" />
        <p>Smarter care. For every appliance.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function ApplianceScene({ explorer = false }) {
  const holder = useRef();
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 680px)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener('change', update);
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setLoaded(true);
      },
      { rootMargin: '100px' }
    );
    observer.observe(holder.current);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', update);
    };
  }, []);
  return (
    <div ref={holder} style={{ width: '100%', height: '100%' }}>
      <SceneBoundary>
        {loaded && (
          <Canvas
            frameloop={visible && !reduced ? 'always' : 'demand'}
            dpr={[1, 1.5]}
            camera={{ position: [0, 0.5, 7], fov: 37 }}
            gl={{ antialias: true, powerPreference: 'low-power' }}
            aria-label={
              explorer
                ? 'Interactive washing machine component explorer'
                : 'Floating washing machine, refrigerator, air conditioner, microwave and television'
            }
          >
            <Suspense fallback={null}>
              <Scene explorer={explorer} reduced={reduced} />
            </Suspense>
          </Canvas>
        )}
      </SceneBoundary>
    </div>
  );
}
