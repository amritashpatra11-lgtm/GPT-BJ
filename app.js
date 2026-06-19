(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pointer = { x: 0, y: 0, nx: 0, ny: 0 };
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.nx = (event.clientX / innerWidth - .5) * 2;
    pointer.ny = (event.clientY / innerHeight - .5) * 2;
    document.querySelector('.cursor-glow')?.style.setProperty('--x', `${event.clientX}px`);
    document.querySelector('.cursor-glow')?.style.setProperty('--y', `${event.clientY}px`);
  }, { passive: true });

  class CanvasScene {
    constructor(id, draw, options = {}) {
      this.canvas = document.getElementById(id);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.draw = draw;
      this.options = options;
      this.w = 0; this.h = 0; this.dpr = 1; this.visible = false;
      this.start = performance.now();
      this.resize = this.resize.bind(this);
      this.frame = this.frame.bind(this);
      this.observer = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) requestAnimationFrame(this.frame);
      }, { rootMargin: '20%' });
      this.observer.observe(this.canvas);
      new ResizeObserver(this.resize).observe(this.canvas);
      this.resize();
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(devicePixelRatio || 1, 1.75);
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.options.onResize?.(this);
    }
    frame(now) {
      if (!this.visible) return;
      const t = reducedMotion ? 1.2 : (now - this.start) / 1000;
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.draw(this.ctx, this, t);
      if (!reducedMotion) requestAnimationFrame(this.frame);
    }
  }

  const drawStars = (ctx, scene, t, amount = 180, seed = 1, speed = .08) => {
    const { w, h } = scene;
    ctx.save();
    for (let i = 0; i < amount; i++) {
      const a = Math.sin((i + 1) * 128.172 + seed * 17.31) * 43758.5453;
      const b = Math.sin((i + 1) * 93.527 + seed * 28.19) * 24634.6345;
      const x = (a - Math.floor(a)) * w;
      const baseY = (b - Math.floor(b)) * h;
      const y = (baseY + t * speed * (i % 5 + 1) * 10) % h;
      const twinkle = .35 + .65 * Math.abs(Math.sin(t * (.5 + (i % 7) * .12) + i));
      const size = i % 31 === 0 ? 2.2 : i % 9 === 0 ? 1.15 : .55;
      ctx.fillStyle = i % 13 === 0 ? `rgba(130,170,255,${twinkle})` : i % 17 === 0 ? `rgba(255,160,140,${twinkle * .8})` : `rgba(255,255,255,${twinkle * .72})`;
      ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  const softGlow = (ctx, x, y, radius, stops) => {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stops.forEach(([stop, color]) => grad.addColorStop(stop, color));
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  };

  new CanvasScene('heroCanvas', (ctx, scene, t) => {
    const { w, h } = scene;
    ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, w, h);
    drawStars(ctx, scene, t, Math.round(clamp(w / 5, 140, 300)), 2, .03);
    const cx = w * .5 + pointer.nx * 10;
    const cy = h * .52 + pointer.ny * 7;
    const base = Math.min(w, h) * (w < 600 ? .39 : .40);
    softGlow(ctx, cx, cy, base * 1.22, [[0,'rgba(33,41,100,.05)'],[.58,'rgba(50,48,150,.08)'],[1,'rgba(0,0,0,0)']]);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const points = w < 600 ? 880 : 1550;
    for (let i = 0; i < points; i++) {
      const p = i / points;
      const a = p * TAU + t * .09;
      const distortion = Math.sin(a * 3 + t * .42) * .045 + Math.sin(a * 7 - t * .24) * .018;
      const radius = base * (1 + distortion + (i % 13) / 13 * .055);
      const x = cx + Math.cos(a) * radius * (1 + pointer.nx * .012);
      const y = cy + Math.sin(a) * radius * .83;
      const top = Math.sin(a) < 0;
      const hue = ((a / TAU) * 360 + 205) % 360;
      const color = a < Math.PI ? `hsla(${lerp(218, 298, a / Math.PI)},92%,68%,${.25 + (i % 9) * .045})` : `hsla(${lerp(10, 218, (a - Math.PI) / Math.PI)},94%,66%,${.25 + (i % 9) * .045})`;
      ctx.fillStyle = color;
      const s = .55 + (i % 5) * .2;
      ctx.fillRect(x, y, s, s);
      if (i % 17 === 0) {
        ctx.strokeStyle = color; ctx.lineWidth = .4; ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(cx + Math.cos(a + .025) * radius, cy + Math.sin(a + .025) * radius * .83); ctx.stroke();
      }
    }
    ctx.restore();
    const vignette = ctx.createRadialGradient(cx, cy, base * .1, cx, cy, base * 1.75);
    vignette.addColorStop(0,'rgba(0,0,0,.03)'); vignette.addColorStop(.65,'rgba(0,0,0,.08)'); vignette.addColorStop(1,'rgba(0,0,0,.84)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  });

  new CanvasScene('morphCanvas', (ctx, scene, t) => {
    const { w, h } = scene;
    ctx.fillStyle='#030308';ctx.fillRect(0,0,w,h);drawStars(ctx,scene,t,150,4,.04);
    const cx=w*.5, cy=h*.47;
    ctx.save();ctx.globalCompositeOperation='lighter';
    const rows = w < 600 ? 95 : 160;
    const cols = w < 600 ? 34 : 52;
    for(let r=0;r<rows;r++){
      const v=r/(rows-1); const yy=lerp(h*.08,h*.88,v); const pinch=.18+.82*Math.pow(Math.abs(v-.5)*2,.72);
      for(let c=0;c<cols;c++){
        const u=c/(cols-1); const angle=u*TAU + t*.28 + v*5.5;
        const rad=(w<600?w*.32:w*.23)*pinch*(.82+.18*Math.sin(v*14+t));
        const x=cx+Math.cos(angle)*rad*(.55+.45*Math.sin(v*Math.PI));
        const y=yy+Math.sin(angle)*rad*.16;
        const hue=lerp(218,18,clamp((x-(cx-rad))/(rad*2),0,1));
        const alpha=.12+.42*(1-Math.abs(u-.5)*1.4);
        ctx.fillStyle=`hsla(${hue},92%,67%,${alpha})`;
        const s=.45+(c%5)*.18;ctx.fillRect(x,y,s,s);
      }
    }
    ctx.restore();
    softGlow(ctx,cx,cy,w<600?w*.34:w*.22,[[0,'rgba(82,104,255,.1)'],[.6,'rgba(71,84,255,.04)'],[1,'rgba(0,0,0,0)']]);
  });

  new CanvasScene('waveCanvas', (ctx, scene, t) => {
    const { w, h } = scene;
    ctx.fillStyle='#030308';ctx.fillRect(0,0,w,h);drawStars(ctx,scene,t,115,8,.02);
    const horizon=h*.68; const cols=w<600?55:110, rows=w<600?38:70;
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let r=0;r<rows;r++){
      const depth=r/(rows-1); const y=horizon+Math.pow(depth,1.55)*h*.42;
      ctx.beginPath();
      for(let c=0;c<cols;c++){
        const u=c/(cols-1);const x=lerp(-w*.1,w*1.1,u);
        const wave=Math.sin(u*9+t*.65+depth*2.8)*18*(1-depth)+Math.sin(u*23-t*.33)*5;
        const ridge=Math.exp(-Math.pow((u-.5)*3.2,2))*-70*(1-depth);
        const yy=y+wave+ridge;
        c===0?ctx.moveTo(x,yy):ctx.lineTo(x,yy);
      }
      const hue=lerp(210,12,depth);ctx.strokeStyle=`hsla(${hue},92%,66%,${.08+(1-depth)*.32})`;ctx.lineWidth=.45;ctx.stroke();
    }
    for(let c=0;c<cols;c+=2){
      const u=c/(cols-1);ctx.beginPath();
      for(let r=0;r<rows;r++){
        const depth=r/(rows-1);const x=lerp(-w*.1,w*1.1,u);const y=horizon+Math.pow(depth,1.55)*h*.42;
        const wave=Math.sin(u*9+t*.65+depth*2.8)*18*(1-depth)+Math.sin(u*23-t*.33)*5;
        const ridge=Math.exp(-Math.pow((u-.5)*3.2,2))*-70*(1-depth);
        r===0?ctx.moveTo(x,y+wave+ridge):ctx.lineTo(x,y+wave+ridge);
      }
      ctx.strokeStyle=`rgba(135,154,255,${.035+Math.abs(u-.5)*.025})`;ctx.lineWidth=.35;ctx.stroke();
    }
    ctx.restore();
  });

  new CanvasScene('blackHoleCanvas', (ctx, scene, t) => {
    const { w,h }=scene;ctx.fillStyle='#020207';ctx.fillRect(0,0,w,h);drawStars(ctx,scene,t,280,11,.015);
    const cx=w*(w<850?.5:.38)+pointer.nx*6, cy=h*.48+pointer.ny*5; const maxR=Math.min(w,h)*.58;
    ctx.save();ctx.translate(cx,cy);ctx.globalCompositeOperation='lighter';
    const particles=w<600?1300:2500;
    for(let i=0;i<particles;i++){
      const rnd=Math.abs(Math.sin((i+4)*941.31))*1;
      const r=32+Math.pow((i%997)/997,.62)*maxR;
      const speed=.12+50/(r+25); const a=i*2.39996+t*speed+(Math.sin(i*12.44)*.18);
      const flatten=.42+.22*Math.sin(i*.017);
      const x=Math.cos(a)*r; const y=Math.sin(a)*r*flatten;
      const rot=.18; const xx=x*Math.cos(rot)-y*Math.sin(rot); const yy=x*Math.sin(rot)+y*Math.cos(rot);
      const warm=(Math.cos(a)+1)/2; const alpha=clamp(.16+44/(r+30),.16,.85)*(i%5?1:.45);
      ctx.fillStyle=warm>.5?`rgba(255,151,125,${alpha})`:`rgba(133,169,255,${alpha})`;
      const s=r<90?1.25:.55+(i%4)*.18;ctx.fillRect(xx,yy,s,s);
    }
    ctx.restore();
    softGlow(ctx,cx,cy,100,[[0,'rgba(0,0,0,1)'],[.44,'rgba(0,0,0,1)'],[.58,'rgba(80,58,140,.15)'],[1,'rgba(0,0,0,0)']]);
    ctx.fillStyle='#000';ctx.beginPath();ctx.arc(cx,cy,Math.min(w,h)*.075,0,TAU);ctx.fill();
  });

  new CanvasScene('gridCanvas', (ctx, scene, t) => {
    const {w,h}=scene;ctx.fillStyle='#040409';ctx.fillRect(0,0,w,h);drawStars(ctx,scene,t,120,14,.025);
    const spacing=w<600?38:58;ctx.save();ctx.translate(pointer.nx*5,pointer.ny*3);
    for(let x=-spacing;x<w+spacing;x+=spacing){const g=.035+.025*Math.sin(x*.02+t);ctx.strokeStyle=`rgba(119,119,255,${g})`;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+w*.08,h);ctx.stroke();}
    for(let y=-spacing;y<h+spacing;y+=spacing){ctx.strokeStyle='rgba(255,255,255,.035)';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y+h*.03);ctx.stroke();}
    ctx.restore();
    softGlow(ctx,w*.72,h*.42,Math.min(w,h)*.45,[[0,'rgba(98,68,214,.14)'],[.5,'rgba(39,68,180,.06)'],[1,'rgba(0,0,0,0)']]);
  });

  new CanvasScene('finalCanvas', (ctx, scene, t) => {
    const {w,h}=scene;ctx.fillStyle='#030308';ctx.fillRect(0,0,w,h);drawStars(ctx,scene,t,220,18,.025);
    const cx=w*.5,cy=h*.52,r=Math.min(w,h)*(w<600?.28:.31);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<900;i++){
      const a=i/900*TAU-t*.08;const wobble=Math.sin(a*5+t)*.035;const rr=r*(1+wobble+(i%17)*.0025);
      const x=cx+Math.cos(a)*rr;const y=cy+Math.sin(a)*rr*.68;
      const hue=a<Math.PI?lerp(220,293,a/Math.PI):lerp(8,220,(a-Math.PI)/Math.PI);
      ctx.fillStyle=`hsla(${hue},95%,68%,${.17+(i%8)*.06})`;ctx.fillRect(x,y,.65+(i%4)*.22,.65+(i%4)*.22);
    }
    ctx.restore();
    softGlow(ctx,cx,cy,r*1.35,[[0,'rgba(37,40,90,.04)'],[.65,'rgba(63,49,150,.07)'],[1,'rgba(0,0,0,0)']]);
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        if (entry.target.querySelector?.('.counter')) animateCounter(entry.target.querySelector('.counter'));
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .17 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  const animateCounter = (el) => {
    if (!el || el.dataset.done) return;
    el.dataset.done = 'true'; const target = Number(el.dataset.target || 0); const started=performance.now();
    const tick=(now)=>{const p=clamp((now-started)/1300,0,1);const eased=1-Math.pow(1-p,4);el.textContent=Math.round(target*eased);if(p<1)requestAnimationFrame(tick)};
    requestAnimationFrame(tick);
  };

  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${id}`));
    });
  }, { threshold:.45 });
  document.querySelectorAll('section[id]').forEach(section => sectionObserver.observe(section));

  const menuToggle=document.getElementById('menuToggle');const nav=document.getElementById('navLinks');
  menuToggle?.addEventListener('click',()=>{const open=menuToggle.classList.toggle('open');nav.classList.toggle('open',open);menuToggle.setAttribute('aria-expanded',String(open));});
  navLinks.forEach(link=>link.addEventListener('click',()=>{menuToggle?.classList.remove('open');nav?.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false');}));

  let previousY=scrollY; let ticking=false;
  addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{const y=scrollY;document.getElementById('siteHeader')?.classList.toggle('hidden',y>previousY&&y>150);previousY=y;ticking=false;});},{passive:true});

  document.querySelectorAll('.magnetic').forEach(el=>{
    el.addEventListener('pointermove',e=>{if(innerWidth<900)return;const r=el.getBoundingClientRect();el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.12}px,${(e.clientY-r.top-r.height/2)*.12}px)`;});
    el.addEventListener('pointerleave',()=>el.style.transform='');
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
