import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { useThreeD } from './ThreeDProvider';
import { SceneFallback } from './SceneFallback';

export const CampusScene: React.FC = () => {
  const navigate = useNavigate();
  const { isSupported, prefersReducedMotion, isMobile } = useThreeD();
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupported || prefersReducedMotion || isMobile || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 420;

    // 1. Scene, Camera & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); // Slate-950
    scene.fog = new THREE.FogExp2(0x020617, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 12, 22);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6); // Cyan-400 tint
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x818cf8, 1.2); // Indigo-400
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xa855f7, 2, 25); // Purple-500
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    // 3. Low-Poly Campus Ground & Pathways
    const groundGeo = new THREE.PlaneGeometry(40, 40, 16, 16);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Slate-900
      roughness: 0.8,
      metalness: 0.2,
      wireframe: false,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);

    // Grid Overlay
    const grid = new THREE.GridHelper(40, 20, 0x0284c7, 0x1e293b);
    grid.position.y = -0.48;
    scene.add(grid);

    // Central Glowing Pathway
    const pathGeo = new THREE.PlaneGeometry(4, 30);
    const pathMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.3,
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.y = -0.45;
    scene.add(path);

    // 4. Stylized Low-Poly Campus Buildings
    const buildingsGroup = new THREE.Group();

    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.7,
    });

    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.7,
    });

    const buildingSpecs = [
      { x: -8, z: -6, w: 5, h: 8, d: 5 },
      { x: 8, z: -8, w: 6, h: 10, d: 5 },
      { x: -10, z: 4, w: 4, h: 6, d: 6 },
      { x: 9, z: 3, w: 5, h: 7, d: 5 },
      { x: 0, z: -10, w: 8, h: 12, d: 6 }, // Main Library/Center Building
    ];

    buildingSpecs.forEach((spec) => {
      const bGeo = new THREE.BoxGeometry(spec.w, spec.h, spec.d);
      const bMesh = new THREE.Mesh(bGeo, buildingMat);
      bMesh.position.set(spec.x, spec.h / 2 - 0.5, spec.z);
      buildingsGroup.add(bMesh);

      // Glowing Windows
      const winGeo = new THREE.BoxGeometry(spec.w + 0.1, spec.h * 0.6, spec.d + 0.1);
      const winMesh = new THREE.Mesh(winGeo, windowMat);
      winMesh.position.set(spec.x, spec.h / 2 - 0.5, spec.z);
      buildingsGroup.add(winMesh);
    });

    scene.add(buildingsGroup);

    // 5. Floating Ambient Particles
    const particleCount = 40;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      pPositions[i] = (Math.random() - 0.5) * 30;
      pPositions[i + 1] = Math.random() * 12 + 1;
      pPositions[i + 2] = (Math.random() - 0.5) * 30;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.25,
      transparent: true,
      opacity: 0.8,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // 6. Subtle Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    const targetX = 0;
    const targetY = 12;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      const y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
      mouseX = x * 2.5;
      mouseY = y * 1.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 7. Render Loop with Visibility Observer
    let animationFrameId: number;
    let isVisible = true;

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      // Gentle camera movement
      camera.position.x += (targetX + mouseX - camera.position.x) * 0.05;
      camera.position.y += (targetY + mouseY - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      // Slow particle drift
      const positions = particles.geometry.attributes.position.array as Float32Array;
      for (let i = 1; i < particleCount * 3; i += 3) {
        positions[i] += 0.01;
        if (positions[i] > 15) positions[i] = 1;
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Pulse Central Light
      pointLight.intensity = 1.8 + Math.sin(Date.now() * 0.002) * 0.4;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isSupported, prefersReducedMotion, isMobile]);

  if (!isSupported || prefersReducedMotion || isMobile) {
    return <SceneFallback />;
  }

  const nodeLinks = [
    { label: 'GROUPS', route: '/groups', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
    { label: 'EVENTS', route: '/events', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { label: 'OPPORTUNITIES', route: '/opportunities', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
    { label: 'ACADEMIC', route: '/academic', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { label: 'MARKETPLACE', route: '/marketplace', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { label: 'ACTIVITY', route: '/activity', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  ];

  return (
    <div className="relative w-full h-[380px] sm:h-[440px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Overlay UI Node Buttons */}
      <div className="absolute inset-x-0 bottom-4 z-10 flex flex-wrap items-center justify-center gap-2 px-4">
        {nodeLinks.map((node) => (
          <button
            key={node.label}
            onClick={() => navigate(node.route)}
            className={`px-3 py-1.5 rounded-full border backdrop-blur-md font-mono text-[11px] font-bold shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 ${node.color}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            <span>{node.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CampusScene;
