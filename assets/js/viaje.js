(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const canvas = $('#space');
  const ctx = canvas && canvas.getContext('2d', { alpha:false });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scenes = ['intro','warp','universe','garden','final'];
  const colors = ['#fffce8','#fff6bf','#ffd75d','#ff9dc8','#b9e9ff','#f4d2ff'];
  let current = 'intro', sceneChanging = false, launched = false;
  let w = innerWidth, h = innerHeight, dpr = 1, stars = [], sparks = [], tick = 0;
  let speed = .065, speedGoal = .065, mx = 0, my = 0, driftX = 0, driftY = 0, last = performance.now();
  let musicOn = false;
  const player = $('#music');
  const sound = $('#sound');
  const bottom = $('#bottom');
  const popup = $('#popup');
  const starCount = () => innerWidth < 680 ? 480 : 900;
  const rand = (a,b) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const pastel = () => colors[(Math.random()*colors.length)|0];
  let stageTimers = [];
  const later = (fn,ms) => {const t = setTimeout(fn,ms);stageTimers.push(t);return t};
  const clearStageTimers = () => {for(const t of stageTimers)clearTimeout(t);stageTimers=[]};

  function createStar(first=false){
    return {
      x:rand(-1.8,1.8), y:rand(-1.45,1.45),z:first?rand(.12,2):rand(1.4,2.2),
      c:pastel(),s:rand(.35,1.35),phase:rand(0,Math.PI*2)
    };
  }
  function resize(){
    if(!ctx)return;
    w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,w<680?1.2:1.6);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    stars=Array.from({length:starCount()},()=>createStar(true));
  }
  function radial(x,y,r,c0,c1){
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,c0);g.addColorStop(1,c1);return g;
  }
  function drawBackdrop(t){
    const cx=w*.5+driftX*22,cy=h*.51+driftY*22;
    const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.76);
    const center=current==='garden'||current==='final'?'#30200e':current==='universe'?'#302035':current==='warp'?'#161734':'#211538';
    grad.addColorStop(0,center);grad.addColorStop(.32,'#121026');grad.addColorStop(.67,'#080716');grad.addColorStop(1,'#020309');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    const lum = (current==='warp'||launched&&current==='intro')?.38:current==='garden'?.20:.14;
    ctx.fillStyle=radial(cx,cy,Math.min(w,h)*.55,`rgba(255,215,96,${lum})`,'rgba(255,215,96,0)');ctx.fillRect(0,0,w,h);
    ctx.fillStyle=radial(w*.22,h*.28,Math.min(w,h)*.34,'rgba(193,70,173,.13)','rgba(193,70,173,0)');ctx.fillRect(0,0,w,h);
    ctx.fillStyle=radial(w*.84,h*.66,Math.min(w,h)*.32,'rgba(78,145,237,.12)','rgba(78,145,237,0)');ctx.fillRect(0,0,w,h);
    if(current==='warp'){
      ctx.fillStyle=radial(cx,cy,Math.min(w,h)*.13,'rgba(255,249,205,.39)','rgba(255,249,205,0)');ctx.beginPath();ctx.arc(cx,cy,Math.min(w,h)*.13,0,Math.PI*2);ctx.fill();
    }
  }
  function drawStars(dt,t){
    const centerX=w*.5+driftX*29,centerY=h*.5+driftY*24;
    const base=Math.min(w,h)*.49;
    for(const st of stars){
      const oldz=st.z;
      st.z-=speed*dt;
      if(st.z<.03){Object.assign(st,createStar());continue;}
      const x=centerX+st.x/st.z*base;
      const y=centerY+st.y/st.z*base;
      if(x<-w*.25||x>w*1.25||y<-h*.25||y>h*1.25){Object.assign(st,createStar());continue;}
      const px=centerX+st.x/oldz*base;
      const py=centerY+st.y/oldz*base;
      const alpha=clamp(.18+1.3/(st.z+1.1),.2,.96);
      const s=clamp(st.s*(2.1-st.z)*1.5,.4,3.4);
      ctx.globalAlpha=alpha;
      ctx.strokeStyle=st.c;ctx.fillStyle=st.c;
      ctx.lineWidth=Math.max(.55,s*.8);
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,s,0,Math.PI*2);ctx.fill();
      if(s>2.2 && tick%4===0){ctx.globalAlpha=alpha*.13;ctx.beginPath();ctx.arc(x,y,s*3.8,0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha=1;
  }
  function drawSparks(dt){
    for(let i=sparks.length-1;i>=0;i--){
      const s=sparks[i];s.x+=s.vx*dt*60;s.y+=s.vy*dt*60;s.vy+=dt*9;s.life-=dt*.52;
      if(s.life<=0){sparks.splice(i,1);continue;}
      ctx.globalAlpha=clamp(s.life,0,1);ctx.fillStyle=s.color;
      ctx.beginPath();ctx.arc(s.x,s.y,Math.max(.1,s.r*s.life),0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  function burst(x=w*.5,y=h*.5,amount=160){
    for(let i=0;i<amount;i++){
      const a=rand(0,Math.PI*2),vel=rand(1.1,5.1);
      sparks.push({x,y,vx:Math.cos(a)*vel,vy:Math.sin(a)*vel,r:rand(.8,3.5),life:rand(.6,1.5),color:pastel()});
    }
  }
  function frame(t){
    if(!ctx)return;
    const dt=clamp((t-last)/1000,.001,.05);last=t;
    tick++;
    speed+=(speedGoal-speed)*.034;
    driftX+=(mx-driftX)*.04;driftY+=(my-driftY)*.04;
    drawBackdrop(t);drawStars(dt,t);drawSparks(dt);
    requestAnimationFrame(frame);
  }
  if(ctx){resize();requestAnimationFrame(frame);addEventListener('resize',resize)}
  addEventListener('pointermove',e=>{mx=(e.clientX/innerWidth-.5)*1.3;my=(e.clientY/innerHeight-.5)*1.1},{passive:true});
  addEventListener('visibilitychange',()=>last=performance.now());

  function floatWords(words=['🌻','✨','💛'],count=15){
    const box=$('#floaters');
    for(let i=0;i<count;i++){
      const n=document.createElement('span');n.className='floater';n.textContent=words[(Math.random()*words.length)|0];
      n.style.left=rand(7,91)+'%';n.style.top=rand(18,82)+'%';
      n.style.fontSize=rand(16,37)+'px';n.style.animationDelay=rand(0,.5)+'s';
      box.appendChild(n);setTimeout(()=>n.remove(),4100);
    }
  }
  const goals={intro:.065,warp:1.05,universe:.14,garden:.09,final:.085};
  const hints={intro:'TOCA EL GIRASOL PARA DESPEGAR · MUEVE EL MOUSE PARA EXPLORAR',warp:'ESTRELLAS A TODA VELOCIDAD · ESTÁS ENTRANDO AL UNIVERSO',universe:'TOCA LOS PLANETAS · CADA UNO GUARDA UN MENSAJE',garden:'TOCA LAS FLORES · DESCUBRE PEQUEÑAS SORPRESAS',final:'ESTAS FLORES VIAJARON HASTA TI · ¡SONRÍE!'};
  function changeScene(next,quick=false){
    if(sceneChanging||!scenes.includes(next)||current===next)return;
    sceneChanging=true;clearStageTimers();
    const old=$('#'+current),incoming=$('#'+next);
    speedGoal=reduce?.16:Math.max(speedGoal,.8);
    if(old)old.classList.add('exit');
    $('#flash').classList.add('on');
    setTimeout(()=>{
      if(old){old.classList.remove('active','exit');old.setAttribute('aria-hidden','true')}
      current=next;incoming.classList.add('active');incoming.removeAttribute('aria-hidden');
      speedGoal=reduce?.08:goals[next];
      $$('.progress i').forEach((node,index)=>node.classList.toggle('on',index<=scenes.indexOf(next)));
      bottom.textContent=hints[next];
      $('#flash').classList.remove('on');
      burst(w*.5,h*.5,next==='final'?245:85);
      if(next==='garden')floatWords(['🌻','🌼','💛','¡Llegaron!'],24);
      if(next==='final')floatWords(['🌻','💐','✨','Para ti','¡Sorpresa!'],30);
      sceneChanging=false;
    },quick?80:420);
  }

  function playMusic(){
    if(!player)return;
    player.volume=.65;
    const promise=player.play();
    if(promise&&promise.then)promise.then(()=>{musicOn=true;sound.textContent='♫ Pausar';sound.setAttribute('aria-pressed','true')}).catch(()=>{musicOn=false;sound.textContent='♫ Música';});
  }
  sound.addEventListener('click',()=>{
    if(musicOn){player.pause();musicOn=false;sound.textContent='♫ Música';sound.setAttribute('aria-pressed','false')}
    else playMusic();
  });
  const enter3d=$('#enter3d');
  const universo3dOverlay=$('#universo3dOverlay');
  const universo3dFrame=$('#universo3dFrame');
  const cerrarUniverso3d=$('#cerrarUniverso3d');
  function abrirUniverso3d(){
    if(!universo3dOverlay||!universo3dFrame)return;
    if(!universo3dFrame.getAttribute('src'))universo3dFrame.src=universo3dFrame.dataset.src;
    universo3dOverlay.classList.add('active');
    universo3dOverlay.setAttribute('aria-hidden','false');
    cerrarUniverso3d?.focus({preventScroll:true});
  }
  function cerrarVista3d(continuar=false){
    if(!universo3dOverlay)return;
    universo3dOverlay.classList.remove('active');
    universo3dOverlay.setAttribute('aria-hidden','true');
    if(continuar)setTimeout(()=>changeScene('garden'),460);
    else setTimeout(()=>enter3d?.focus({preventScroll:true}),350);
  }
  enter3d?.addEventListener('click',abrirUniverso3d);
  cerrarUniverso3d?.addEventListener('click',()=>cerrarVista3d(false));
  addEventListener('message',event=>{
    if(event.source!==universo3dFrame?.contentWindow)return;
    if(event.data?.type==='flores-continuar-viaje')cerrarVista3d(true);
  });
  $('#restart').addEventListener('click',()=>{launched=false;changeScene('intro')});

  const status=$('#introStatus');
  function launch(){
    if(launched||sceneChanging)return;
    launched=true;
    $('#intro').classList.add('go');
    playMusic();
    speedGoal=reduce?.26:2.45;
    floatWords(['🌻','✨','💛','¡Despegue!','Flores amarillas'],25);
    burst(w*.5,h*.5,290);
    const lines=['🌻 FLORES A BORDO','🚀 PROPULSORES ENCENDIDOS','✨ CRUZANDO AÑOS LUZ','💛 TU SORPRESA ESTÁ MÁS CERCA'];
    lines.forEach((line,i)=>later(()=>{status.textContent=line},i*750));
    later(()=>{$('#intro').classList.remove('go');changeScene('warp')},3650);
  }
  $('#launch').addEventListener('click',launch);
  $('#sunLaunch').addEventListener('click',launch);
  $('#warpNext').addEventListener('click',()=>changeScene('universe'));
  $$('[data-next]').forEach(btn=>btn.addEventListener('click',()=>changeScene(btn.dataset.next)));

  const messages=[
    ['🌟','Tu luz','Hay mujeres que cambian el ambiente de un lugar con una sola sonrisa. Ojalá hoy recuerdes que tú también puedes ser esa luz.'],
    ['✨','Tu brillo','No necesitas compararte con nadie. Hasta las estrellas brillan de formas distintas, y eso es justamente lo hermoso del universo.'],
    ['🌻','Tu alegría','Para quien da tanto sin esperar nada: que también te lleguen sorpresas, abrazos sinceros y flores cuando menos lo imagines.'],
    ['💛','Tu calma','Que nunca te falte alguien que celebre tu manera de ser, incluso en los días en que tú misma olvides lo especial que eres.']
  ];
  const flowerMessages=['Por todas las flores que no llegaron antes, aquí tienes una que sí pensó en ti. 🌻','Que este septiembre también te deje un recuerdo bonito. ✨','No esperes una fecha para recordarte lo valiosa que eres. 💛','Hoy una flor lleva tu nombre, aunque todavía no lo hayas leído. 🌼','Que te sorprendan sin que tengas que pedirlo. 💐','Hay mujeres que merecen jardines enteros de detalles bonitos. 🌻','Si nadie te entregó una flor, el universo acaba de hacerlo. ✨'];
  function showPopup(icon,title,text){
    $('#popIcon').textContent=icon;$('#popTitle').textContent=title;$('#popText').textContent=text;
    popup.classList.add('show');popup.setAttribute('aria-hidden','false');
    burst(w*.5,h*.54,95);
  }
  const closePopup=()=>{popup.classList.remove('show');popup.setAttribute('aria-hidden','true')};
  $('#popupClose').addEventListener('click',closePopup);
  $('#popOK').addEventListener('click',closePopup);
  popup.addEventListener('click',e=>{if(e.target===popup)closePopup()});
  addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    closePopup();
    if(universo3dOverlay?.classList.contains('active'))cerrarVista3d(false);
  });
  $$('[data-planet]').forEach(p=>p.addEventListener('click',()=>{const m=messages[+p.dataset.planet];showPopup(...m)}));
  $$('[data-flower]').forEach(p=>p.addEventListener('click',e=>{
    const i=+p.dataset.flower;showPopup('🌻','Una flor para ti',flowerMessages[i]);
    floatWords(['🌻','💛','✨','🌼'],10);
  }));
  $('#surprise').addEventListener('click',()=>{burst(w*.5,h*.43,340);floatWords(['🌻','💐','✨','💛','¡Estas son para ti!','Mereces flores'],70)});
  let lastTouch=0;
  $('#space').addEventListener('pointerdown',e=>{
    const now=performance.now();if(now-lastTouch<325){burst(e.clientX,e.clientY,125);floatWords(['✨','🌻','💛'],12)}lastTouch=now;
  });

  const etapaInicial=new URLSearchParams(location.search).get('etapa');
  if(etapaInicial==='garden'){
    launched=true;
    changeScene('garden',true);
    try{history.replaceState({},'',location.pathname)}catch(_error){}
  }
})();
