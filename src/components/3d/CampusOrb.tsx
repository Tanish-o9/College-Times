import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThreeD } from './ThreeDProvider';

export const CampusOrb: React.FC = () => {
  const { isSupported, prefersReducedMotion } = useThreeD();
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupported || prefersReducedMotion || !mountRef.current) return;

    const container = mountRef.current;
    const width = 64;
    const height = 64;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.z = 2.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Glowing Sphere Geometry
    const geo = new THREE.SphereGeometry(0.8, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
    });
    const orb = new THREE.Mesh(geo, mat);
    scene.add(orb);

    // Wireframe Outer Ring
    const ringGeo = new THREE.TorusGeometry(1.05, 0.02, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    // Lighting
    const light = new THREE.PointLight(0x38bdf8, 3, 10);
    light.position.set(2, 2, 2);
    scene.add(light);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      orb.rotation.y += 0.008;
      ring.rotation.x += 0.01;
      ring.rotation.y += 0.01;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isSupported, prefersReducedMotion]);

  if (!isSupported || prefersReducedMotion) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 animate-pulse shadow-md shadow-sky-500/30" />
    );
  }

  return <div ref={mountRef} className="w-16 h-16 flex items-center justify-center shrink-0" />;
};

export default CampusOrb;
