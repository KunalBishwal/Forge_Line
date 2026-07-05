import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Text, Environment } from "@react-three/drei";
import gsap from "gsap";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { onRealtime } from "@/lib/socket";
import type { JobStatus, JobStatusChangedEvent } from "@/lib/types";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const PLATFORMS: { key: string; label: string; x: number; y: number; color: string }[] = [
  { key: "queued", label: "QUEUED", x: -8, y: 0, color: "#8b879c" },
  { key: "claimed", label: "CLAIMED", x: -4, y: 0, color: "#4cdbff" },
  { key: "running", label: "RUNNING", x: 0, y: 0, color: "#ff7a45" },
  { key: "completed", label: "COMPLETED", x: 4, y: 0, color: "#5eead4" },
  { key: "dead_letter", label: "DEAD LETTER", x: 8, y: -1.4, color: "#ff4d5e" },
];

const STATUS_TO_PLATFORM: Record<JobStatus, number | null> = {
  queued: 0,
  claimed: 1,
  running: 2,
  failed: 2,
  completed: 3,
  dead_letter: 4,
  cancelled: null,
};

interface Block {
  id: string;
  mesh: THREE.Mesh;
  target: THREE.Vector3;
  color: THREE.Color;
  targetColor: THREE.Color;
  life: number; // seconds since last transition
  fading: boolean;
}

function platformSlot(index: number, count: number): THREE.Vector3 {
  const p = PLATFORMS[index];
  const col = count % 4;
  const row = Math.floor(count / 4) % 3;
  return new THREE.Vector3(p.x - 0.9 + col * 0.6, p.y + 0.6 + row * 0.5, -0.6 + (count % 3) * 0.6);
}

function Platforms() {
  return (
    <group>
      {PLATFORMS.map((p) => (
        <group key={p.key} position={[p.x, p.y, 0]}>
          <RoundedBox args={[3, 0.4, 3]} radius={0.12} smoothness={4} position={[0, 0, 0]}>
            <meshStandardMaterial
              color="#16141f"
              emissive={p.color}
              emissiveIntensity={0.25}
              metalness={0.6}
              roughness={0.4}
            />
          </RoundedBox>
          {/* glow ring */}
          <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.7, 1.9, 48]} />
            <meshBasicMaterial color={p.color} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          <Text position={[0, 1.1, 0]} fontSize={0.34} color={p.color} anchorX="center" anchorY="middle" letterSpacing={0.08}>
            {p.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

function Blocks() {
  const groupRef = useRef<THREE.Group>(null);
  const blocks = useRef<Map<string, Block>>(new Map());
  const counts = useRef<number[]>(PLATFORMS.map(() => 0));
  const geom = useMemo(() => new THREE.BoxGeometry(0.42, 0.42, 0.42), []);

  useEffect(() => {
    const seed = (id: string, status: JobStatus) => {
      const pIdx = STATUS_TO_PLATFORM[status];
      if (pIdx == null || !groupRef.current) return;
      const slot = platformSlot(pIdx, counts.current[pIdx]++);
      const color = new THREE.Color(PLATFORMS[pIdx].color);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.2 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(slot);
      mesh.position.y += 3; // drop-in
      groupRef.current.add(mesh);
      blocks.current.set(id, { id, mesh, target: slot, color, targetColor: color.clone(), life: 0, fading: false });
    };

    // pre-seed a handful so the scene reads as populated immediately
    (["queued", "claimed", "running", "completed", "dead_letter"] as JobStatus[]).forEach((s, i) =>
      seed(`seed_${i}`, s),
    );

    const off = onRealtime<JobStatusChangedEvent>("job:status_changed", (evt) => {
      const pIdx = STATUS_TO_PLATFORM[evt.to];
      if (pIdx == null || !groupRef.current) return;
      let b = blocks.current.get(evt.jobId);
      const slot = platformSlot(pIdx, counts.current[pIdx]++);
      const target = new THREE.Color(PLATFORMS[pIdx].color);
      if (!b) {
        const fromIdx = STATUS_TO_PLATFORM[evt.from] ?? pIdx;
        const start = platformSlot(fromIdx, 0);
        const color = new THREE.Color(PLATFORMS[fromIdx].color);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.2 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(start);
        groupRef.current.add(mesh);
        b = { id: evt.jobId, mesh, target: slot, color, targetColor: target, life: 0, fading: false };
        blocks.current.set(evt.jobId, b);
      } else {
        b.target = slot;
        b.targetColor = target;
        b.life = 0;
        b.fading = false;
      }
      if (evt.to === "completed") b.fading = true;
      // cap total blocks
      if (blocks.current.size > 60) {
        const first = blocks.current.keys().next().value as string;
        const old = blocks.current.get(first);
        if (old) {
          groupRef.current?.remove(old.mesh);
          blocks.current.delete(first);
        }
      }
    });
    return () => off();
  }, [geom]);

  useFrame((_, dt) => {
    blocks.current.forEach((b) => {
      b.life += dt;
      b.mesh.position.lerp(b.target, Math.min(1, dt * 4));
      b.mesh.rotation.y += dt * 0.8;
      const mat = b.mesh.material as THREE.MeshStandardMaterial;
      mat.color.lerp(b.targetColor, Math.min(1, dt * 3));
      mat.emissive.lerp(b.targetColor, Math.min(1, dt * 3));
      if (b.fading && b.life > 1.2) {
        mat.transparent = true;
        mat.opacity = Math.max(0, mat.opacity - dt * 0.8);
        b.mesh.position.y += dt * 1.5;
        if (mat.opacity <= 0.02 && groupRef.current) {
          groupRef.current.remove(b.mesh);
          blocks.current.delete(b.id);
        }
      }
    });
  });

  return <group ref={groupRef} />;
}

function Rig({ reduced }: { reduced: boolean }) {
  const { camera } = useThree();
  const t = useRef(0);
  useEffect(() => {
    camera.position.set(0, 18, 22);
    camera.lookAt(0, 0, 0);
    if (reduced) {
      camera.position.set(2, 9, 15);
      camera.lookAt(0, 0, 0);
      return;
    }
    const tween = gsap.to(camera.position, {
      x: 2,
      y: 9,
      z: 15,
      duration: 2.2,
      ease: "power3.inOut",
      onUpdate: () => camera.lookAt(0, 0, 0),
    });
    return () => {
      tween.kill();
    };
  }, [camera, reduced]);
  useFrame((_, dt) => {
    if (reduced) return;
    t.current += dt * 0.15;
    camera.position.x = 2 + Math.sin(t.current) * 1.5;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Pipeline3D() {
  const reduced = useReducedMotion();
  return (
    <Canvas dpr={[1, 1.8]} camera={{ fov: 42, position: [0, 18, 22] }} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={["#0a0912"]} />
      <fog attach="fog" args={["#0a0912", 24, 46]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 12, 8]} intensity={80} color="#ff7a45" />
      <pointLight position={[-10, 8, -6]} intensity={40} color="#4cdbff" />
      <Environment preset="night" />
      <Rig reduced={reduced} />
      <Platforms />
      <Blocks />
      <gridHelper args={[60, 60, "#1c1a26", "#161420"]} position={[0, -1.6, 0]} />
    </Canvas>
  );
}