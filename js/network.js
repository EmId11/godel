/* =========================================================
   Godel Analytics — hero network simulation
   A force-directed organisational network rendered on canvas.
   Nodes are sized & coloured by degree centrality (cool blue
   periphery -> glowing gold connectors). Light packets pulse
   along edges to represent information flow. The cursor parts
   the network and lights up the nearest connector.
   ========================================================= */
(function () {
  "use strict";

  const canvas = document.getElementById("network");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Palette ----
  const COOL = [93, 139, 244];   // periphery
  const MID  = [223, 230, 247];  // transitional / ice
  const GOLD = [255, 194, 75];   // hubs / connectors

  let W = 0, H = 0, dpr = 1;
  let nodes = [], edges = [];
  const mouse = { x: -9999, y: -9999, active: false };
  let raf = null;

  // ---- Helpers ----
  const rand = (a, b) => a + Math.random() * (b - a);
  function lerp3(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }
  // degree -> colour (blue -> ice -> gold), kept cool for most nodes
  function colourFor(t) {
    const c = t < 0.5 ? lerp3(COOL, MID, t / 0.5) : lerp3(MID, GOLD, (t - 0.5) / 0.5);
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // ---- Build a clustered "org" network ----
  function build() {
    nodes = [];
    edges = [];

    const isSmall = W < 720;
    const clusterCount = isSmall ? 4 : 6;
    const cx = W / 2, cy = H / 2;
    const ringR = Math.min(W, H) * (isSmall ? 0.26 : 0.3);

    const clusters = [];
    for (let c = 0; c < clusterCount; c++) {
      const a = (c / clusterCount) * Math.PI * 2 + rand(-0.3, 0.3);
      clusters.push({
        x: cx + Math.cos(a) * ringR * rand(0.7, 1.15),
        y: cy + Math.sin(a) * ringR * rand(0.6, 1.0),
        hub: -1,
      });
    }

    // Nodes per cluster
    clusters.forEach((cl, ci) => {
      const n = isSmall ? Math.round(rand(7, 11)) : Math.round(rand(11, 17));
      const start = nodes.length;
      for (let i = 0; i < n; i++) {
        nodes.push({
          x: cl.x + rand(-50, 50),
          y: cl.y + rand(-50, 50),
          vx: 0, vy: 0,
          deg: 0, t: 0, r: 3,
          cluster: ci,
        });
      }
      cl.start = start;
      cl.end = nodes.length;
      cl.hub = start; // first node of each cluster is its local hub
    });

    const addEdge = (a, b) => {
      if (a === b) return;
      edges.push({ a, b, ph: Math.random(), sp: rand(0.12, 0.32) });
    };

    // Intra-cluster: everyone links to the local hub + a couple of peers
    clusters.forEach((cl) => {
      for (let i = cl.start; i < cl.end; i++) {
        if (i !== cl.hub) addEdge(i, cl.hub);
        const peers = Math.round(rand(1, 2));
        for (let p = 0; p < peers; p++) {
          const j = Math.floor(rand(cl.start, cl.end));
          if (Math.random() < 0.7) addEdge(i, j);
        }
      }
    });

    // Inter-cluster: connect hubs in a ring + a few cross bridges
    for (let c = 0; c < clusters.length; c++) {
      const next = (c + 1) % clusters.length;
      addEdge(clusters[c].hub, clusters[next].hub);
      if (Math.random() < 0.6) {
        const far = Math.floor(rand(0, clusters.length));
        addEdge(clusters[c].hub, clusters[far].hub);
      }
      // a stray peripheral "broker" bridging two clusters
      if (Math.random() < 0.5) {
        const a = Math.floor(rand(clusters[c].start, clusters[c].end));
        const b = Math.floor(rand(clusters[next].start, clusters[next].end));
        addEdge(a, b);
      }
    }

    // Degree -> centrality t -> radius + neighbour lists
    nodes.forEach((n) => { n.deg = 0; n.nbrs = []; });
    edges.forEach((e) => {
      nodes[e.a].deg++; nodes[e.b].deg++;
      nodes[e.a].nbrs.push(e.b); nodes[e.b].nbrs.push(e.a);
    });
    let maxDeg = 1;
    nodes.forEach((n) => { if (n.deg > maxDeg) maxDeg = n.deg; });
    nodes.forEach((n) => {
      n.t = Math.pow(n.deg / maxDeg, 1.35);       // bias most nodes cool
      n.r = 2.6 + n.t * 7.5;
      n.colour = colourFor(n.t);
    });

    // Pre-settle the layout so it opens already organised
    for (let s = 0; s < 140; s++) step(1, false);
  }

  // ---- Physics ----
  function step(dt, withMouse) {
    const cx = W / 2, cy = H / 2;
    const REP = 1500, SPRING = 0.018, REST = 78, CENTER = 0.0009, DAMP = 0.9;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      let fx = 0, fy = 0;

      // repulsion (O(n^2), fine for < ~120 nodes)
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        if (d2 > 62500) continue; // ignore beyond 250px
        const inv = 1 / Math.sqrt(d2);
        const f = REP / d2;
        fx += dx * inv * f;
        fy += dy * inv * f;
      }

      // centering
      fx += (cx - a.x) * CENTER;
      fy += (cy - a.y) * CENTER;

      // cursor repulsion — part the network
      if (withMouse && mouse.active) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 26000 && d2 > 1) {
          const inv = 1 / Math.sqrt(d2);
          const f = 9000 / d2;
          fx += dx * inv * f;
          fy += dy * inv * f;
        }
      }

      a.vx = (a.vx + fx * dt) * DAMP;
      a.vy = (a.vy + fy * dt) * DAMP;
    }

    // spring attraction along edges
    for (let k = 0; k < edges.length; k++) {
      const a = nodes[edges[k].a], b = nodes[edges[k].b];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - REST) * SPRING;
      const ux = (dx / d) * f, uy = (dy / d) * f;
      a.vx += ux; a.vy += uy;
      b.vx -= ux; b.vy -= uy;
    }

    // integrate + soft bounds
    const m = 40;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const sp = Math.hypot(n.vx, n.vy);
      if (sp > 3.2) { n.vx *= 3.2 / sp; n.vy *= 3.2 / sp; }
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < m) n.vx += (m - n.x) * 0.04;
      if (n.x > W - m) n.vx -= (n.x - (W - m)) * 0.04;
      if (n.y < m) n.vy += (m - n.y) * 0.04;
      if (n.y > H - m) n.vy -= (n.y - (H - m)) * 0.04;
    }
  }

  // ---- Find nearest node to cursor ----
  function nearest() {
    if (!mouse.active) return -1;
    let best = -1, bd = 52 * 52;
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - mouse.x, dy = nodes[i].y - mouse.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---- Render ----
  let time = 0;
  function draw() {
    time += 0.016;
    ctx.clearRect(0, 0, W, H);

    const hot = nearest();
    const lit = new Set();
    if (hot >= 0) { lit.add(hot); nodes[hot].nbrs.forEach((n) => lit.add(n)); }

    // edges
    ctx.lineWidth = 1;
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k];
      const a = nodes[e.a], b = nodes[e.b];
      const isLit = hot >= 0 && (e.a === hot || e.b === hot);
      ctx.strokeStyle = isLit ? "rgba(255,194,75,0.55)" : "rgba(150,170,220,0.10)";
      ctx.lineWidth = isLit ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // information pulse travelling toward the higher-degree node
      if (!reduceMotion) {
        const frac = (time * e.sp + e.ph) % 1;
        const from = a.t <= b.t ? a : b;
        const to = a.t <= b.t ? b : a;
        const px = from.x + (to.x - from.x) * frac;
        const py = from.y + (to.y - from.y) * frac;
        const fade = Math.sin(frac * Math.PI);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,210,120,${(isLit ? 0.9 : 0.45) * fade})`;
        ctx.arc(px, py, isLit ? 2.1 : 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // cursor tether to nearest connector
    if (hot >= 0) {
      ctx.strokeStyle = "rgba(255,194,75,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(mouse.x, mouse.y);
      ctx.lineTo(nodes[hot].x, nodes[hot].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isLit = lit.has(i);
      const r = n.r * (isLit ? 1.35 : 1);

      // glow
      const glow = n.r * (n.t > 0.55 ? 4.2 : 2.6) * (isLit ? 1.5 : 1);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glow);
      const base = n.t > 0.55 ? "255,194,75" : "120,160,235";
      g.addColorStop(0, `rgba(${base},${0.22 + n.t * 0.25})`);
      g.addColorStop(1, `rgba(${base},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, glow, 0, Math.PI * 2);
      ctx.fill();

      // core
      ctx.beginPath();
      ctx.fillStyle = isLit ? "#fff6df" : n.colour;
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Loop ----
  function frame() {
    step(1, true);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // ---- Sizing ----
  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  // ---- Events ----
  function pointer(e) {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    mouse.x = p.clientX - rect.left;
    mouse.y = p.clientY - rect.top;
    mouse.active = true;
  }
  window.addEventListener("mousemove", pointer, { passive: true });
  window.addEventListener("touchmove", pointer, { passive: true });
  window.addEventListener("mouseout", () => { mouse.active = false; });
  window.addEventListener("touchend", () => { mouse.active = false; });

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 200);
  });

  // Pause when the hero scrolls out of view
  const hero = document.querySelector(".hero");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && !raf) raf = requestAnimationFrame(frame);
        else if (!en.isIntersecting && raf) { cancelAnimationFrame(raf); raf = null; }
      });
    }, { threshold: 0 }).observe(hero);
  }

  resize();
  raf = requestAnimationFrame(frame);
})();
