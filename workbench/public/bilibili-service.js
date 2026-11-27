/* Built-in Bilibili surface: guest discovery + honest official embed + playable local fixture. */
(function(){
'use strict';
const H=s=>esc(String(s??'')),DEMO='/bilibili/focus-demo.mp4';
const samples=[
 {id:'demo-focus',title:'用焦点操作，找到观看的节奏',author:'Lego OS · 本地交互样片',description:'原创测试图与提示音，用来验证播放、步进、镜像、倍速、字幕与离线。不是 B 站内容。',duration:30,topic:'焦点 交互 科技',tone:'pink'},
 {id:'demo-mirror',title:'镜像跟练：让左右更直观',author:'Lego OS · 本地交互样片',description:'不对称测试图用于检查左右反转，字幕和控制条不随画面镜像。',duration:30,topic:'镜像 学习 舞蹈',tone:'blue'},
 {id:'demo-subtitle',title:'慢一点，看清每一句字幕',author:'Lego OS · 本地交互样片',description:'选择字幕和倍速；改变设置时不重置播放进度。',duration:30,topic:'字幕 学习',tone:'purple'}
].map(x=>({...x,mode:'demo',parts:[{page:1,title:'交互样片'}]}));
const discovery = BilibiliDiscovery.create(localStorage, [
  {id:'BV1or1HzXEi1',cover:'https://i2.hdslb.com/bfs/storyff/_00002vovi42v3r8lt2cimivzj9yjh3b_firsti.jpg',title:'《绝区零》挽昼动画短片 | 最后的旅途',author:'绝区零',duration:1078,topic:'动画与游戏',reason:'完整动画短片，适合一口气看完'},
  {id:'BV19k1Jz5Ea8',cover:'https://i1.hdslb.com/bfs/storyff/_00001khzojcv679ed2sv9ck14xno2kb_firsti.jpg',title:'《明日方舟》SideStory「星星不愿入睡」活动宣传PV',author:'明日方舟',duration:364,topic:'动画与游戏',reason:'六分钟看一个新故事的世界观'},
  {id:'BV1EY4y1A7tJ',cover:'https://i0.hdslb.com/bfs/storyff/n220808qn1h3omq45ryar33phqhc87v2_firsti.jpg',title:'全球趣事儿大揭秘 · TED-Ed 英语科普',author:'惊叹号的英语世界',topic:'知识与科技',reason:'多分集科普 · 按集观看'},
  {id:'BV1Dd1HzVENm',cover:'https://i0.hdslb.com/bfs/storyff/_00001zjldottrusbp2q5q2xb1a35awb_firsti.jpg',title:'【毕导】最对味的一集！如何放出无声的屁？响屁不臭臭屁不响是真的吗？',author:'毕导',duration:754,topic:'知识与科技',reason:'用实验回答一个日常问题'}
].map(v => ({...v,mode:'official',url:'https://www.bilibili.com/video/'+v.id})));
let searchSession = {query:'',mode:'live',items:[],error:'',notice:''};
let viewTitle = '', account = 'disconnected', qr = '', pollTimer, stream = null;
let loginMessage = '';
let dashPlayer = null;
let loginAttempt = 0, loginBusy = false;
const read=()=>{try{return JSON.parse(localStorage.getItem('lego-bilibili-v1')||'{}')}catch{return {}}};
const saved=read();let state={route:'home',panel:'',mode:'demo',items:samples,query:'',selected:samples[0],busy:false,error:'',notice:'',rate:[.5,.75,1,1.25,1.5,2].includes(saved.rate)?saved.rate:1,mirror:!!saved.mirror,subtitle:saved.subtitle!==false,danmaku:!!saved.danmaku,curated:!!saved.curated,history:saved.history||{},cache:[],cacheBusy:false,cacheError:'',offline:false,part:1};
let media=null,mediaID='',mediaURL='',generation=0,lastSave=0;const stack=[],focusMemory=new Map(),scrollMemory=new Map(),browseHeights=new Map();
function persist(){try{localStorage.setItem('lego-bilibili-v1',JSON.stringify({rate:state.rate,mirror:state.mirror,subtitle:state.subtitle,danmaku:state.danmaku,curated:state.curated,history:state.history}))}catch{state.notice='浏览器未能保存观看设置。'}}
const scope=()=>state.route+':'+(state.route==='shelf'?viewTitle+':':'')+state.panel;
const active=()=>osPage==='bilibili';
const button=(id,label,extra='')=>`<button type="button" data-bili-id="${H(id)}" ${extra}>${H(label)}</button>`;
const icons = {
  play:'<path d="m9 5 12 7-12 7Z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M9 5v14M16 5v14" stroke-width="3"/>',
  rewind:'<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
  forward:'<path d="M20 10a8 8 0 1 0-2 8m2-14v6h-6"/>',
  list:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 14h7"/>',
  chat:'<path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3zM8 8h8m-8 5h5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="7"/>',
  back:'<path d="m14 5-7 7 7 7"/>',
  next:'<path d="m7 5 10 7-10 7Z" fill="currentColor" stroke="none"/><path d="M19 5v14"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  discover:'<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4Z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  fullscreen:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  minimize:'<path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[name]}</svg>`;
}
function iconButton(id,label,symbol,extra='',caption='') {
  return `<button type="button" class="bili-icon-button" data-bili-id="${H(id)}" aria-label="${H(label)}" title="${H(label)}" ${extra}>${icon(symbol)}${caption?`<span>${H(caption)}</span>`:''}</button>`;
}
const selected=()=>state.selected;
function officialWatchUrl(video) {
  const url = new URL(video.url);
  const progress = discovery.resume(video.id, state.history);
  if (state.part > 1) url.searchParams.set('p', state.part);
  if (progress && !progress.finished && (!progress.part || progress.part === state.part) && progress.position > 1) {
    url.searchParams.set('t', Math.floor(progress.position));
  }
  return url.href;
}

const scrollArea=()=>document.querySelector('.bili-browse-scroll')||document.querySelector('.bili-body');
function remember(){if(!active())return;const key=document.activeElement?.dataset?.biliId;if(key)focusMemory.set(scope(),key);scrollMemory.set(scope(),scrollArea()?.scrollTop||0)}
function focus(id){const el=[...document.querySelectorAll('.bili-app [data-bili-id]')].find(e=>e.dataset.biliId===id&&!e.disabled&&!e.closest('[inert]'));if(el&&!window.LegoGamepad?.focusElement?.(el)){document.querySelectorAll('.device-focus').forEach(e=>e.classList.remove('device-focus'));el.classList.add('device-focus');el.focus({preventScroll:true});el.scrollIntoView({block:'nearest'});}}
function draw(defaultID){renderOS();requestAnimationFrame(()=>{if(!active())return;const sheet=document.querySelector('.bili-sheet');focus(defaultID||focusMemory.get(scope())||(sheet?sheet.querySelector('[data-bili-id]')?.dataset.biliId:document.querySelector('.bili-app [data-focus-default]')?.dataset.biliId)||'back')})}
function go(route, render = true, origin){if(state.route==='search'){const {query,mode,items,error,notice}=state;searchSession={query,mode,items,error,notice};}generation++;state.busy=false;remember();stack.push({focus:origin||focusMemory.get(scope()),route:state.route,selected:state.selected,part:state.part,items:state.items,query:state.query,mode:state.mode,offline:state.offline,viewTitle,stream,folders:state.folders,error:state.error,notice:state.notice});state.route=route;state.panel='';state.error='';state.notice='';if(route!=='player')media?.pause?.();if(render)draw();}
function back(){if(!active())return false;if(immersive&&!state.panel){setImmersive(false);return true;}if(state.panel){if(state.panel==='danmaku'){state.panel='danmaku-options';draw('danmaku');return true}if(state.panel==='login')stopPoll();state.panel='';draw(focusMemory.get(scope())||'settings');return true}if(stack.length){generation++;state.busy=false;remember();media?.pause?.();const {focus:origin,...previous}=stack.pop();Object.assign(state,previous);viewTitle=previous.viewTitle;stream=previous.stream;draw(origin);return true}osNavigate('center');return true}
function showPanel(panel, initialFocus){remember();state.panel=panel;draw(initialFocus)}
async function request(path,post=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9500);try{const r=await fetch('/api/bilibili/'+path,{signal:controller.signal,...(post?{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'读取失败');return d}finally{clearTimeout(timer)}}
async function loadLive(search=false){const gen=++generation;state.mode='live';state.busy=true;state.error='';state.items=[];draw();try{const data=await request(search?'search?q='+encodeURIComponent(state.query):'home');if(gen!==generation)return;state.items=data.items;state.notice='游客公开内容 · 非个性化推荐'}catch(e){if(gen!==generation)return;state.error=e.name==='AbortError'?'读取超时，请重试或在官方页面继续。':e.message;if(search){state.items=discovery.search(state.query);if(state.items.length)state.notice='以下是本机片库的匹配视频。'}}finally{if(gen===generation){state.busy=false;if(active())draw()}}}
async function detail(id, direct = false) {
  const item = state.items.find(x=>x.id===id) || discovery.find(id) || samples.find(x=>x.id===id);
  if (!item) return;
  go(direct ? 'player' : 'detail',false,direct?'video:'+id:undefined);
  state.selected = item;
  state.part = discovery.resume(id,state.history)?.part || 1;
  state.offline = false;
  stream = null;
  state.busy = direct && item.mode==='official';
  autoStart = direct;
  draw(direct ? 'toggle' : 'watch');
  if (item.mode !== 'official') return;
  const gen = ++generation;
  const q = encodeURIComponent(id);
  const [metadata, parts] = await Promise.allSettled([request('video?id='+q), request('parts?id='+q)]);
  if (gen !== generation) return;
  const next = {...item, ...(metadata.value?.item || {})};
  if (parts.value?.parts?.length) next.parts = parts.value.parts;
  if (!next.parts?.some(part => part.page === state.part)) state.part = 1;
  if (discovery.find(id) && metadata.value?.item) {
    try { discovery.remember(next, {title: item.title === id ? '' : item.title}); } catch { /* Read-only browsing remains usable. */ }
  }
  state.selected = next;
  if(direct)return watchVideo(false,true);
  draw();
}
let autoStart = false;
let immersive = false;
async function watchVideo(preferMp4 = false, autoplay = false) {
  if (state.route !== 'player') go('player',false);
  autoStart = autoplay;
  stream = null;
  if (selected().mode === 'demo') { draw('toggle'); return; }
  const gen = ++generation;
  state.busy = true;
  draw();
  try {
    const result = await request('play?id='+encodeURIComponent(selected().id)+'&page='+state.part+((preferMp4 || !window.dashjs || !window.MediaSource)?'&format=mp4':''));
    if (gen === generation) {
      stream = result;
      discovery.remember(selected());
    }
  } catch (error) {
    if (gen === generation) state.notice = '设备播放器暂不可用。可用 B 站播放器或打开原站。';
  } finally {
    if (gen === generation) {
      state.busy = false;
      draw(stream ? 'toggle' : 'embed-activate');
    }
  }
}
const catalog = id => discovery.find(id) || samples.find(v => v.id === id);
function shelf(title, items, source) {
  go('shelf');
  viewTitle = title;
  state.items = items.filter(Boolean);
  state.notice = source || '';
  draw();
}
async function cloudShelf(kind, folder = '') {
  go('cloud');
  viewTitle = kind === 'history' ? 'B 站观看历史' : 'B 站收藏';
  const gen = ++generation;
  state.items = [];
  state.folders = [];
  state.busy = true;
  draw();
  try {
    const result = await request('account/'+kind+(folder?'?folder='+encodeURIComponent(folder):''));
    if (gen === generation) {
      state.items = result.items || [];
      state.folders = result.folders || [];
    }
  } catch (e) {
    if (gen === generation) state.notice=e.message;
  } finally {
    if (gen === generation) {
      state.busy = false;
      draw();
    }
  }
}
function stopPoll() {
  clearTimeout(pollTimer);
  pollTimer = undefined;
}
async function startLogin() {
  if (loginBusy) return;
  stopPoll();
  const attempt = ++loginAttempt;
  loginBusy = true;
  qr = '';
  loginMessage = '正在创建扫码会话…';
  showPanel('login');
  try {
    const result = await request('login/start', true);
    if (state.panel !== 'login' || !active()) return;
    qr = result.qr;
    loginMessage = '用哔哩哔哩 App 扫码并在手机上确认。';
    pollTimer = setTimeout(() => checkLogin(attempt), 2200);
  } catch (e) {
    loginMessage = e.name === 'AbortError' ? 'B 站暂时没有响应，可以换一张二维码。' : e.message;
  } finally {
    loginBusy = false;
    if (active() && state.panel === 'login') draw();
  }
}
async function checkLogin(attempt) {
  if (state.panel !== 'login' || !active()) return;
  try {
    const result = await request('account/poll');
    if (!active() || state.panel !== 'login' || attempt !== loginAttempt) return;
    if (result.state === 'connected') {
      account = 'connected';
      qr = '';
      state.panel = '';
      draw('cloud-history');
      return;
    }
    if (result.state === 'rejected') {
      qr = '';
      loginMessage = 'B 站未接受这次扫码确认' + (result.code === null ? '。' : '（状态 ' + result.code + '）。');
      draw();
      return;
    }
    if (result.state === 'expired') {
      qr = '';
      loginMessage = '二维码已失效，请重新生成。';
      draw();
      return;
    }
    if (result.state === 'scanned') {
      loginMessage = '已扫码，请在哔哩哔哩 App 中确认。';
      const note = document.querySelector('#bili-qr-note');
      if (note) note.textContent = loginMessage;
    }
    pollTimer = setTimeout(() => checkLogin(attempt), 2500);
  } catch (error) {
    if (!active() || state.panel !== 'login' || attempt !== loginAttempt) return;
    const note = document.querySelector('#bili-qr-note');
    if (note) note.textContent = '暂时无法读取确认状态，正在重试。';
    pollTimer = setTimeout(() => checkLogin(attempt), 3500);
  }
}

function time(t){t=Number.isFinite(+t)?Math.max(0,+t):0;return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`}
const coverRequests = new Map();
let coverObserver;
function coverArt(url, id='', label='', chapters=0, progress=0) {
  const cover = BilibiliDiscovery.coverUrl(url);
  return `<span class="bili-cover" aria-hidden="true" ${!cover&&id?`data-cover-id="${H(id)}"`:''}>
    ${icon('play')}${cover?`<img src="${H(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}
    ${chapters>1?`<span class="bili-cover-parts">${chapters}P</span>`:''}
    ${label?`<small>${H(label)}</small>`:''}
    ${progress>0?`<span class="bili-cover-progress"><i style="width:${progress}%"></i></span>`:''}
  </span>`;
}
function loadVisibleCovers(body) {
  coverObserver?.disconnect();
  if (!body) return;
  coverObserver=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      if(!isIntersecting)continue;
      coverObserver.unobserve(target);
      const id=target.dataset.coverId;
      if(!coverRequests.has(id)){
        coverRequests.set(id,request('video?id='+encodeURIComponent(id))
          .then(data=>BilibiliDiscovery.coverUrl(data.item?.cover),()=> '')
          .then(url=>url||request('parts?id='+encodeURIComponent(id))
            .then(data=>BilibiliDiscovery.coverUrl(data.parts?.[0]?.cover)))
          .catch(()=>{coverRequests.delete(id);return '';}));
      }
      coverRequests.get(id).then(url=>{
        if(!url||!target.isConnected||target.querySelector('img'))return;
        const image=document.createElement('img');
        image.alt='';
        image.referrerPolicy='no-referrer';
        image.src=url;
        target.append(image);
      });
    }
  },{root:body,rootMargin:'60px'});
  body.querySelectorAll('[data-cover-id]').forEach(item=>coverObserver.observe(item));
  body.addEventListener('error',event=>{
    if(event.target.matches('.bili-cover img'))event.target.remove();
  },true);
}
function cards(items) {
  return items.map((video,index)=>{
    const resume=discovery.resume(video.id,state.history);
    const hasProgress=resume&&!resume.finished&&resume.position>1;
    const total=typeof video.duration==='number'?video.duration:0;
    const percent=hasProgress&&total>0&&(video.parts?.length||1)===1?
      Math.min(100,Math.floor(100*resume.position/total)):0;
    const art=coverArt(video.cover || discovery.find(video.id)?.cover,video.mode==='demo'?'':video.id,
      typeof video.duration==='string'&&/^\d+(?::\d{2}){1,2}$/.test(video.duration)?video.duration:video.duration>0?time(video.duration):'',video.parts?.length||0,percent);
    return `<button type="button" class="bili-video-card" data-bili-id="video:${H(video.id)}" ${index===0?'data-focus-default':''}>
      ${art}
      <span class="bili-card-copy"><strong>${H(video.title)}</strong><small>${H(video.author ? 'UP '+video.author : '')}${video.topic&&video.topic!=='未分类'?' · '+H(video.topic):''}</small>
      ${hasProgress||discovery.hasLater(video.id)?`<span class="bili-card-badges">${hasProgress?`<em>P${resume.part||1} · 已看至 ${time(resume.position)}</em>`:''}
      ${discovery.hasLater(video.id)?'<em>稍后看</em>':''}</span>`:''}</span>
    </button>`;
  }).join('');
}
function currentSection() {
  if(state.route==='shelf'&&viewTitle==='推荐')return 'featured';
  return ({home:'recent',search:'search',connect:'connect'})[state.route];
}
function sectionBar(selectedTab) {
  const tabs=[['recent','继续看'],['featured','推荐'],['search','搜索'],['connect','我的']];
  return `<nav class="bili-section-bar" aria-label="B 站服务">
    ${tabs.map(([id,label])=>button(id,label,id===selectedTab?'aria-current="page" data-focus-default':'')).join('')}
  </nav>`;
}
function header(title,sub=''){return `<header class="bili-head"><div><small>bilibili / LEGO OS</small><h1>${H(title)}</h1></div>${iconButton('back','返回上一页','back')}</header>${sub?`<p class="bili-kicker">${H(sub)}</p>`:''}`}
function status(){return `${state.busy?'<p role="status" class="bili-note">正在读取 B 站公开内容…</p>':''}${state.error?`<div class="bili-alert" role="status">${H(state.error)}${button('retry','重新读取')}${state.route==='search'&&state.query?` <a data-bili-id="official-search" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(state.query)}" target="_blank" rel="noopener">在 B 站搜索 ↗</a>`:''}</div>`:''}${state.notice?`<p class="bili-note" role="status">${H(state.notice)}</p>`:''}`}
let homeOrder;
function home() {
  const recent=discovery.recent(state.history).map(catalog).filter(Boolean);
  if(!homeOrder)homeOrder=(recent.length?recent:discovery.featured()).map(video=>video.id);
  const list=homeOrder.map(catalog).filter(Boolean);
  return `<p class="bili-home-notice">${account==='connected'?'设备观看记录':'游客模式 · 观看进度保存在本机'}</p>
    <h1 class="bili-feed-label">${recent.length?'继续观看':'快速开始'}</h1>
    <div class="bili-list bili-video-list">${cards(list)}</div>`;
}
function shelfView() {
  const recommended=viewTitle==='推荐';
  return `${recommended?`<h1 class="bili-feed-label">精选视频 <span>${state.items.length} 条</span></h1>`:header(viewTitle)}${status()}
    <div class="bili-list bili-video-list">${cards(state.items)}</div>
    ${recommended?`<nav class="bili-nav" aria-label="发现分类">${button('topics','主题')}${button('live','B 站热门')}${button('import','添加链接')}</nav>`:''}
    ${!state.busy&&!state.items.length&&!state.notice?'<p class="bili-note">这里暂时没有视频。</p>':''}`;
}
function topicsView() {
  return `${header('主题')}<div class="bili-list bili-topics">
    ${BilibiliDiscovery.topics.map(topic=>button('topic:'+topic,topic+' · '+discovery.byTopic(topic).length)).join('')}
    ${button('import','添加链接')}
  </div>`;
}
function importView() {
  return `${header('添加 B 站视频')}<form id="bili-import-form" class="bili-import">
    <label>视频链接或 BV 号<input name="url" data-bili-id="import-url" required maxlength="250"></label>
    <label>标题（选填）<input name="title" data-bili-id="import-title" maxlength="100"></label>
    <label>主题<select name="topic" data-bili-id="import-topic">${BilibiliDiscovery.topics.map(t=>`<option>${H(t)}</option>`).join('')}</select></label>
    <button data-bili-id="submit" type="submit">添加到片库</button>
  </form><p class="bili-note" id="bili-import-note" role="status"></p>`;
}
function cloudView() {
  return `${header(viewTitle,'来自连接的 B 站账号')}${status()}
    <div class="bili-list">${(state.folders||[]).map(f=>button('folder:'+f.id,f.title)).join('')}${cards(state.items)}</div>
    ${!state.busy&&!state.items.length&&!state.folders?.length&&!state.notice?'<p class="bili-note">B 站返回了空列表。</p>':''}`;
}

function search() {
  const sources=[['live-search','B 站'],['demo','本机片库']];
  return `<div class="bili-library-heading"><h1>搜索</h1></div>
    <form id="bili-search-form">
      <input data-bili-id="query" data-focus-default aria-label="Bilibili 搜索关键词" name="query" maxlength="80" placeholder="标题、UP 主或 BV 号" value="${H(state.query)}">
      <button class="bili-icon-button" data-bili-id="submit" type="submit" aria-label="提交搜索">${icon('search')}</button>
    </form>
    <div class="bili-switch">${sources.map(([id,label])=>button(id,label,`aria-pressed="${(id==='demo')===(state.mode==='demo')}"`)).join('')}</div>
    <div class="bili-quick">${['动画','科技','学习'].map(q=>button('term:'+q,q)).join('')}</div>
    ${status()}<div class="bili-list bili-video-list">${cards(state.items)}</div>
    ${state.query&&!state.busy&&!state.error&&!state.items.length?'<p class="bili-note">没有匹配的视频。</p>':''}`;
}
function details(){const v=selected(),pos=discovery.resume(v.id,state.history)?.finished?0:discovery.resume(v.id,state.history)?.position||0;return `${header('视频详情',v.mode==='demo'?'本地交互样片 · 非 B 站内容':'B 站视频')}<div class="bili-detail-art tone-${v.tone||'blue'}"><span>▶</span><small>${v.mode==='demo'?'LOCAL PLAYBACK TEST':H(v.id)}</small></div><h2 class="bili-title">${H(v.title)}</h2><p class="bili-author">${H(v.author)}</p><div class="bili-actions">${button('watch',pos>1?'继续播放 '+time(pos):'开始观看','data-focus-default')}${button('parts','选集 · '+(v.parts?.length||1))}${button('save-later',discovery.hasLater(v.id)?'取消稍后看':'稍后看',`aria-pressed="${discovery.hasLater(v.id)}"`)}</div><p class="bili-description">${H(v.description||'此视频暂未提供简介。')}</p>${status()}${v.url?`<a data-bili-id="official" href="${H(officialWatchUrl(v))}" target="_blank" rel="noopener">在 B 站打开 ↗</a>`:''}`}
let danmakuItems = [], danmakuStatus = '', danmakuAt = 0;
let overlayWindow = {key:'',items:[],status:''};
function showOverlay(t) {
  const layer = document.querySelector('#bili-danmaku-overlay');
  if (!layer) return;
  if (!state.danmaku || !stream || !media || media.paused) {
    layer.textContent='';
    document.querySelector('#bili-danmaku-status')?.replaceChildren();
    if (!state.danmaku) overlayWindow={key:'',items:[],status:''};
    return;
  }
  const bucket = Math.floor(t/20);
  const key = selected().id+':'+state.part+':'+bucket;
  if (overlayWindow.key!==key) {
    const windowData = {key,items:[],status:''};
    overlayWindow = windowData;
    request('danmaku?id='+encodeURIComponent(selected().id)+'&page='+state.part+'&at='+(bucket*20+10))
      .then(result=>{windowData.items=result.items||[];})
      .catch(()=>{windowData.status='弹幕暂不可用';});
  }
  let items = overlayWindow.items.filter(item=>item.at<=t && t-item.at<4);
  if(state.curated) {
    const seen = new Set();
    items = items.filter(item=>{
      const text = item.text.replace(/[\s\p{P}]/gu,'');
      if(text.length<5 || seen.has(text) || /^(.)\1+$/u.test(text))return false;
      seen.add(text);
      return true;
    }).slice(0,1);
  }
  const text = items.slice(-2).map(item=>item.text).join('\n');
  if(layer.textContent!==text)layer.textContent=text;
  const notice = document.querySelector('#bili-danmaku-status');
  if(notice && notice.textContent!==overlayWindow.status)notice.textContent=overlayWindow.status;
}
async function openDanmaku() {
  danmakuAt = media?.currentTime || 0;
  danmakuItems = [];
  danmakuStatus = '正在读取本集弹幕…';
  showPanel('danmaku');
  const gen = ++generation;
  try {
    const result = await request('danmaku?id='+encodeURIComponent(selected().id)+'&page='+state.part+'&at='+Math.floor(danmakuAt));
    if (gen!==generation || state.panel!=='danmaku') return;
    danmakuItems = result.items || [];
    danmakuStatus = danmakuItems.length ? '' : '这段时间附近没有公开弹幕。';
  } catch {
    if (gen!==generation || state.panel!=='danmaku') return;
    danmakuStatus = '暂时无法读取本集弹幕。';
  }
  draw(danmakuItems.length ? 'danmaku:0' : 'close');
}
function panel(){const p=state.panel;if(!p)return '';let title='',body='';if(p==='settings'){title='播放设置';body=button('mirror','镜像 · '+(state.mirror?'开':'关'),`aria-pressed="${state.mirror}"`)+button('speed','倍速 · '+state.rate+'×')+button('subtitle',stream && !stream.captionCues.length?'此视频暂无可用字幕':'字幕 · '+(state.subtitle?'开':'关'),stream && !stream.captionCues.length?'disabled':`aria-pressed="${state.subtitle}"`)+button('cache-one','离线缓存入口');}
 if(p==='danmaku-options'){
  title='弹幕';
  body=button('danmaku-switch',state.danmaku?'弹幕 · 开':'弹幕 · 关',`aria-pressed="${state.danmaku}"`)+
    button('danmaku-curated',state.curated&&state.danmaku?'精选弹幕 · 开':'精选弹幕 · 关',state.danmaku?`aria-pressed="${state.curated}"`:'disabled aria-pressed="false"')+
    (state.danmaku?'<p>精选在设备端过滤过短、重复的发言，并降低显示密度。</p>':'')+
    button('danmaku','查看附近弹幕');
 }
 if(p==='watch-more'){
  title='视频';
  body=button('watch-info','详情与简介')+button('save-later',discovery.hasLater(selected().id)?'移出稍后看':'加入稍后看')+
    (selected().url?`<a data-bili-id="official" href="${H(officialWatchUrl(selected()))}" target="_blank" rel="noopener">在 B 站继续观看 ↗</a>`:'');
 }
 if(p==='danmaku'){
  title='附近弹幕 · '+time(danmakuAt);
  body=danmakuStatus?'<p role="status">'+H(danmakuStatus)+'</p>':danmakuItems.map((item,index)=>
    `<div class="bili-danmaku-item" data-focus-region tabindex="0" data-bili-id="danmaku:${index}"><time>${time(item.at)}</time><span>${H(item.text)}</span></div>`).join('');
 }
 if(p==='speed'){title='播放倍速';body=[.5,.75,1,1.25,1.5,2].map(r=>button('rate:'+r,r+'×',`aria-pressed="${state.rate===r}"`)).join('')}
 if(p==='parts'){
  const video=selected(),parts=video.parts?.length?video.parts:[{page:1,title:'正片'}];
  title='选集 · '+parts.length+' 集';
  body=parts.map(part=>{
    const current=state.part===part.page;
    return `<button class="bili-episode-card" type="button" data-bili-id="part:${part.page}" aria-pressed="${current}">
      ${coverArt(part.cover||video.cover)}<span class="bili-episode-copy"><small>P${part.page}${current?' · 当前播放':''}</small>
      <strong>${H(part.title)}</strong></span>${icon(current?'pause':'play')}</button>`;
  }).join('');
 }

 if(p==='cache'){title='离线缓存';body=selected().mode==='demo'?`<p>保存此 30 秒本地样片，用于验证离线播放。包含镜像、倍速及字幕体验。</p><p role="status" id="bili-cache-status">${state.cacheBusy?'正在写入浏览器存储…':H(state.cacheError||'这不会下载任何 B 站视频。')}</p>${state.cacheBusy?'':button('download','保存样片供离线观看')}`:`<p>此 B 站视频可在线观看。</p><p>可前往 B 站 App 查看该视频是否允许缓存。</p><a data-bili-id="official-cache" href="${H(selected().url)}" target="_blank" rel="noopener">在 B 站继续 ↗</a>`;}
 if(p==='login'){
  title='连接 B 站账号';
  body=`<p id="bili-qr-note" role="status">${H(loginMessage)}</p>${qr?`<img class="bili-qr" alt="哔哩哔哩扫码登录" src="${H(qr)}">`:''}${loginBusy?'':button('login','重新生成二维码')}`;
 }
 return `<div class="bili-scrim"><section class="bili-sheet" role="dialog" aria-modal="true" aria-label="${H(title)}"><h2>${H(title)}</h2><div class="bili-sheet-items">${body}${button('close','关闭')}</div></section></div>`}
function player() {
  const video = selected();
  const demo = video.mode === 'demo';
  const native = demo || !!stream;
  const part = video.parts?.find(item => item.page === state.part);
  const heading = part && video.parts.length > 1 ? 'P'+state.part+' · '+part.title : video.title;
  const next = video.parts?.find(item => item.page===state.part+1);
  const nextCover = next?.cover || video.cover;
  const controls = native ? `
    <div class="bili-transport" aria-label="播放控制">
      ${iconButton('rewind','后退 5 秒','rewind','','5')}
      ${iconButton('toggle','播放或暂停','play','data-focus-default')}
      ${iconButton('forward','前进 5 秒','forward','','5')}
      ${!demo?iconButton('danmaku-options','弹幕设置','chat',`aria-pressed="${state.danmaku}"`):''}
      ${iconButton('settings','播放设置','settings')}
      ${iconButton('fullscreen',immersive?'退出全屏':'全屏播放',immersive?'minimize':'fullscreen')}
    </div>
    <div class="bili-watch-actions">
      ${iconButton('parts','选集 · P'+state.part,'list','','选集')}
      ${button('watch-more','更多 ···')}
    </div>
    ${next?`<button type="button" class="bili-up-next" data-bili-id="next-part"><span class="bili-next-cover">${nextCover?`<img src="${H(nextCover)}" alt="" referrerpolicy="no-referrer">`:''}${icon('next')}</span><span><small>接下来播放 · P${next.page}</small><strong>${H(next.title)}</strong></span></button>`:''}` : state.busy ? '' : `
    <div class="bili-controls secondary">
      ${button('embed-activate','进入官方播放器','data-focus-default')}${button('parts','选集 · P'+state.part)}
    </div>
    <a data-bili-id="official-player-link" href="${H(officialWatchUrl(video))}" target="_blank" rel="noopener">在 B 站继续观看 ↗</a>`;
  return `<div class="bili-watch-heading">
      <div><h1 title="${H(heading)}">${H(heading)}</h1><p>${H(part && video.parts.length>1 ? video.title : video.author)}</p></div>
      ${iconButton('back','返回上一页','back')}
    </div>
    <div class="bili-video-stage">
      <div class="bili-media-mount"></div>
      <div id="bili-danmaku-overlay" aria-hidden="true"></div>
      ${native?'<div id="bili-captions" class="bili-captions" hidden></div>':''}
      ${native?'<progress id="bili-progress-bar" max="1" value="0" aria-label="播放进度"></progress>':''}
      <p class="bili-play-status" id="bili-play-status" role="status">${state.busy?'正在加载…':''}</p>
    </div>
    ${controls}
    <p class="bili-watch-meta"><span id="bili-time"></span><span>${H(demo?(state.offline?'离线样片':'本地样片'):video.author)}</span><span id="bili-flags"></span><span id="bili-danmaku-status" role="status"></span></p>
    ${!native && !state.busy && state.notice?`<p class="bili-note">${H(state.notice)}</p>`:''}
    <p id="bili-media-error" class="bili-alert" role="status" hidden></p>`;
}

function cacheView(){return `${header('离线缓存','仅显示已校验的本地样片')}<p class="bili-note">${H(state.cacheError||'本地缓存不等于 B 站 App 离线视频；B站内容缓存需单独能力。')}</p><div class="bili-list">${state.cache.length?state.cache.map(c=>`<section class="bili-cache-card"><h2>${H(c.title)}</h2><p>${(c.bytes/1024/1024).toFixed(1)} MB · ${c.exists?'已保存':'文件缺失'}</p><div class="bili-actions">${button('offline:'+c.id,'离线播放')}${button('remove:'+c.id,'删除本地缓存')}</div></section>`).join(''):'<p class="bili-note">还没有缓存。打开本地样片，在播放器中选择“缓存”。</p>'}</div>`}
function connect(){
  const connected = account === 'connected';
  const row=(id,label,description,symbol)=>`<button class="bili-account-row" type="button" data-bili-id="${id}">
    ${icon(symbol)}<span><strong>${H(label)}</strong><small>${H(description)}</small></span></button>`;
  return `<div class="bili-library-heading"><h1>我的</h1><p>${connected?'B 站账号已连接':'游客 · 观看记录保存在本机'}</p></div>
    <div class="bili-account-list">
      ${row('my-recent','继续观看','接着上次的分集和位置','history')}
      ${row('later','稍后看',discovery.later().length+' 条视频','list')}
      ${row('cache-list','离线缓存','本地样片','play')}
      ${connected?row('cloud-history','B 站观看历史','账号同步','history')+row('cloud-folders','B 站收藏','账号同步','list')+button('disconnect','断开账号'):''}
    </div>
    <h2 class="bili-section-title">B 站网页记录</h2>
    <div class="bili-account-list">
      ${row('web-history','已导入历史',discovery.webHistory().length+' 条视频','history')}
      ${row('web-favorites','已导入收藏',discovery.webFavorites().length+' 条视频','list')}
      ${row('web-import','导入网页记录','保存到当前浏览器','user')}
      ${row('sample-shelf','交互样片','测试焦点与播放设置','play')}
    </div>`;
}
function webImport() {
  return `${header('导入网页记录')}<form id="bili-web-import-form" class="bili-import">
    <label>记录数据<textarea name="snapshot" rows="7" data-bili-id="web-snapshot" maxlength="100000" required></textarea></label>
    <button data-bili-id="submit" type="submit">保存到本机</button>
  </form><p class="bili-note" id="bili-web-import-note" role="status"></p>`;
}
function render(){
  const section=currentSection();
  const screen=({home,search,detail:details,player,cache:cacheView,connect,shelf:shelfView,topics:topicsView,import:importView,cloud:cloudView,webImport})[state.route]();
  const content=section?`${sectionBar(section)}<div class="bili-browse-scroll">${screen}</div>
    <footer class="bili-browse-hints"><span><kbd>↑↓←→</kbd> 移焦</span><span><kbd>A</kbd> 确认</span><span><kbd>B</kbd> 返回</span></footer>`:screen;
  const mode=section?'bili-browsing':state.route==='player'?'bili-watching'+(immersive?' bili-immersive':''):'';
  return `<section class="bili-app ${mode}" data-route="${H(state.route)}"><div class="bili-body" ${state.panel?'inert':''}>${content}</div>${panel()}</section>`;
}

// Cache storage uses IndexedDB blobs; no credentials or B站 media are stored.
function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open('lego-bilibili-cache',1);req.onupgradeneeded=()=>req.result.createObjectStore('videos',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('当前浏览器无法使用离线存储'));})}
async function transaction(mode,action){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('videos',mode),req=action(tx.objectStore('videos'));let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{database.close();resolve(result)};tx.onerror=()=>{database.close();reject(Error('离线存储操作失败，可能空间不足'))};tx.onabort=()=>{database.close();reject(Error('离线存储操作已取消'))}})}
async function refreshCache(){try{const records=await transaction('readonly',store=>store.getAll());state.cache=records.map(c=>({id:c.id,title:c.title,bytes:c.blob.size,exists:c.blob.size>0}));state.cacheError=''}catch(e){state.cacheError=e.message}}
async function download(){if(state.cacheBusy||selected().mode!=='demo')return;const v=selected();state.cacheBusy=true;state.cacheError='';draw();try{const r=await fetch(DEMO);if(!r.ok)throw Error('样片读取失败');const blob=await r.blob();if(blob.size<1024||!blob.type.startsWith('video/'))throw Error('样片文件校验失败');await transaction('readwrite',store=>store.put({id:v.id,title:v.title,blob,at:Date.now()}));const stored=await transaction('readonly',store=>store.get(v.id));if(stored?.blob?.size!==blob.size)throw Error('缓存写入后校验失败');await refreshCache();state.cacheError='已保存并校验，可从“缓存”页面离线播放。'}catch(e){state.cacheError=e.message}finally{state.cacheBusy=false;if(active())draw()}}
function saveProgress(video,id,part) {
  const t=video?.currentTime;
  if (!Number.isFinite(t) || t<=1) return;
  const previous=state.history[id];
  const entry={position:t, at:Date.now(),part,finished:video.ended||t>=video.duration-1};
  const parts={...previous?.parts};
  if(previous?.part&&!parts[previous.part])parts[previous.part]={position:previous.position,finished:previous.finished};
  parts[part]={position:entry.position,finished:entry.finished};
  state.history[id]={...entry,parts};
  persist();
}
window.addEventListener('pagehide',()=>{
  if(state.route==='player' && !state.busy && media?.tagName==='VIDEO')saveProgress(media,selected().id,state.part);
});
function release(){if(dashPlayer){const previous=dashPlayer;dashPlayer=null;previous.reset()}media?.pause?.();if(mediaURL)URL.revokeObjectURL(mediaURL);mediaURL='';media=null;mediaID=''}
function applySettings(){if(!media||media.tagName!=='VIDEO')return;media.playbackRate=state.rate;media.classList.toggle('bili-mirrored',state.mirror);for(const track of media.textTracks)track.mode='hidden';updateMedia()}
function updateMedia(){if(!active()||state.route!=='player'||!media||media.tagName!=='VIDEO')return;const t=media.currentTime||0;const bar=document.querySelector('#bili-progress-bar');if(bar)bar.value=Number.isFinite(media.duration)&&media.duration>0?t/media.duration:0;const timer=document.querySelector('#bili-time');if(timer)timer.textContent=time(t)+' / '+time(media.duration||selected().duration||30);const play=document.querySelector('[data-bili-id="toggle"]');if(play&&play.dataset.paused!==String(media.paused)){play.dataset.paused=String(media.paused);play.innerHTML=icon(media.paused?'play':'pause');play.title=media.paused?'播放':'暂停'}showOverlay(t);const flags=document.querySelector('#bili-flags');if(flags)flags.textContent=state.rate+'×'+(state.mirror?' · 镜像':'')+(state.subtitle&&(!stream||stream.captionCues.length)?' · 字幕':'');const caps=document.querySelector('#bili-captions');if(caps){const cues=['本地交互样片 · 非 B 站视频','镜像仅反转画面，字幕保持可读','方向键移焦 · 确认执行 · 返回退出','倍速、字幕与离线可在本地验证'];const caption=stream?stream.captionCues.find(c=>c.from<=t&&c.to>t)?.text:cues[t<7?0:t<15?1:t<23?2:3];caps.textContent=state.subtitle?(caption||''):'';caps.hidden=!caps.textContent}if(Date.now()-lastSave>1500){lastSave=Date.now();saveProgress(media,selected().id,state.part)}}
async function mountMedia(){const mount=document.querySelector('.bili-media-mount');if(!mount||state.busy)return;const v=selected(),id=v.id+':'+state.part+':'+state.offline+':'+(stream?.manifest||stream?.src||'');if(mediaID!==id){release();mediaID=id;if(v.mode==='demo'||stream){media=document.createElement('video');media.playsInline=true;media.preload='metadata';media.setAttribute('aria-label',stream?'B 站视频画面':'本地交互样片画面');media.tabIndex=-1;const expected=id;if(state.offline){try{const item=await transaction('readonly',s=>s.get(v.id));if(mediaID!==expected)return;if(!item?.blob?.size)throw Error('缓存文件不存在，请重新保存');mediaURL=URL.createObjectURL(item.blob);media.src=mediaURL}catch(e){const el=document.querySelector('#bili-media-error');if(el){el.hidden=false;el.textContent=e.message}return}}else if(!stream?.manifest)media.src=stream?.src||DEMO;media.volume=(osData?.settings?.volume??60)/100;const video=media, partAtMount=state.part;media.onended=()=>saveProgress(video,v.id,partAtMount);media.onloadedmetadata=()=>{const recent=discovery.resume(v.id,state.history);const old=recent?.parts?.[partAtMount] || ((!recent?.part||recent.part===partAtMount)?recent:null);const position=old&&!old.finished?old.position:0;video.currentTime=Number.isFinite(position)&&position<video.duration-1?position:0;applySettings();if(autoStart){autoStart=false;video.play().catch(()=>{});}};media.ontimeupdate=updateMedia;media.onplay=updateMedia;
 const playbackStatus = text => {
   const el = document.querySelector('#bili-play-status');
   if (el && media===video) el.textContent=text;
 };
 let bufferTimer;
 const clearBuffer = () => { clearTimeout(bufferTimer); playbackStatus(''); };
 media.onwaiting=()=>{
   clearTimeout(bufferTimer);
   bufferTimer=setTimeout(()=>{if(!video.paused)playbackStatus('正在缓冲');},400);
 };
 media.onplaying=clearBuffer;
 media.onseeked=()=>{if(video.readyState>=3)clearBuffer();};media.onpause=()=>{clearBuffer();updateMedia();saveProgress(video,v.id,partAtMount)};media.onerror=()=>{
  if(media!==video||!active()||state.route!=='player')return;
  if(stream?.manifest){if(!state.busy)void watchVideo(true, !media?.paused || autoStart);return}
  if(stream){stream=null;state.notice='设备播放器无法读取此媒体，请用 B 站播放器观看。';draw('embed-activate');return}
  const el=document.querySelector('#bili-media-error');
  if(el){el.hidden=false;el.textContent='样片无法播放，请重试或检查本地缓存。'}
 };}else{media=document.createElement('iframe');media.src='https://player.bilibili.com/player.html?bvid='+encodeURIComponent(v.id)+'&page='+state.part+'&autoplay=0&danmaku=0';media.title='Bilibili 官方播放器';media.allow='fullscreen; encrypted-media; picture-in-picture';media.allowFullscreen=true;media.referrerPolicy='strict-origin-when-cross-origin';media.tabIndex=-1;}}
 if(!active()||state.route!=='player')return;document.querySelector('.bili-media-mount')?.replaceChildren(media);
 if(stream?.manifest && !dashPlayer){
   const dash = window.dashjs.MediaPlayer().create();
   dashPlayer = dash;
   dash.on(window.dashjs.MediaPlayer.events.ERROR,()=>{
     if(dash!==dashPlayer || !active() || state.route!=='player' || state.busy)return;
     void watchVideo(true, !media?.paused || autoStart);
   });
   dash.initialize(media,stream.manifest,false);
 }
 applySettings()}
const content=osContent;osContent=function(){return active()?render():content()};
const baseRender=renderOS;renderOS=function(){if(media?.isConnected)media.remove();if(!active()||state.route!=='player')media?.pause?.();baseRender();if(active()){if(state.panel){const sheet=document.querySelector('.bili-sheet');if(sheet){document.querySelector('.bili-app').append(sheet.parentElement);document.querySelector('.bili-body').inert=true;window.LegoGamepad?.refreshFocus(false)}}const body=scrollArea();
 if(body){
  const key=scope();
  body.scrollTop=scrollMemory.get(key)||0;
  if(body.matches('.bili-browse-scroll')){
   const previousHeight=browseHeights.get(key);
   browseHeights.set(key,body.clientHeight);
   const focused=body.querySelector('.device-focus');
   if(focused&&previousHeight&&previousHeight!==body.clientHeight){
    const bounds=body.getBoundingClientRect(),card=focused.getBoundingClientRect();
    const scale=bounds.height/body.offsetHeight||1;
    if(card.bottom>bounds.bottom-4)body.scrollTop+=(card.bottom-bounds.bottom+4)/scale;
    else if(card.top<bounds.top+4)body.scrollTop-=(bounds.top+4-card.top)/scale;
   }
  }
  body.addEventListener('scroll',()=>{if(body.isConnected)scrollMemory.set(key,body.scrollTop)},{passive:true});
 }
 loadVisibleCovers(body);const form=document.querySelector('#bili-search-form');if(form)form.onsubmit=e=>{e.preventDefault();doSearch(form.elements.query.value)};const importer=document.querySelector('#bili-import-form');
 if(importer) importer.onsubmit=e=>{
  e.preventDefault();
  const fields=Object.fromEntries(new FormData(importer));
  try {
   const id=discovery.add(fields.url,{title:fields.title.trim(),topic:fields.topic});
   detail(id);
  } catch(error) {document.querySelector('#bili-import-note').textContent=error.message;}
 };
 const webImporter=document.querySelector('#bili-web-import-form');
 if(webImporter) webImporter.onsubmit=e=>{
  e.preventDefault();
  try {
   const counts=discovery.importSnapshot(JSON.parse(webImporter.elements.snapshot.value));
   shelf('B 站网页历史',discovery.webHistory(),'已导入 '+counts.history+' 条历史和 '+counts.favorites+' 条收藏。');
  } catch {
   document.querySelector('#bili-web-import-note').textContent='导入失败，请检查记录格式或浏览器存储。';
  }
 };
 if(state.route==='player')mountMedia();}};
function doSearch(q){state.query=String(q||'').trim().slice(0,80);if(!state.query){state.notice='请输入搜索词';draw('query');return}state.route='search';if(state.mode==='live')loadLive(true);else{state.items=discovery.search(state.query);state.error='';state.notice='来自本机片库';draw()}}
const click=osClick;osClick=async function(e){const b=e.target.closest('[data-bili-id]');if(!b||!active())return click(e);const id=b.dataset.biliId;if(b.matches('input,select,textarea,a')||id==='submit')return;
 if(id==='back')return back();if(id==='search'){if(state.route==='search'){focus('query');return}go('search',false);Object.assign(state,searchSession);draw('query');return}if(id==='connect'){
  if(state.route==='connect')return;
  go('connect');
  const gen=generation;
  try { account=(await request('account/status')).state; } catch { account='disconnected'; }
  if(active()&&gen===generation) draw();
  return;
 }
 if(id==='featured'){if(currentSection()!=='featured')shelf('推荐',discovery.featured());return;}
 if(id==='recent'||id==='my-recent'){if(state.route!=='home'){homeOrder=null;go('home')}return;}
 if(id==='later')return shelf('稍后看',discovery.later().map(catalog));
 if(id==='topics')return go('topics');
 if(id.startsWith('topic:'))return shelf(id.slice(6),discovery.byTopic(id.slice(6)));
 if(id==='import')return go('import');
 if(id==='sample-shelf')return shelf('交互样片',samples);
 if(id==='save-later'){
  try { discovery.toggleLater(selected()); }
  catch { state.notice='本机存储不可用，无法保存稍后看。'; }
  draw('save-later');
  return;
 }
 if(id==='login')return startLogin();
 if(id==='disconnect'){
  try { await request('login/disconnect',true); account='disconnected'; }
  catch(e) {state.notice=e.message;}
  draw();
  return;
 }
 if(id==='web-import')return go('webImport');
 if(id==='web-history')return shelf('B 站网页历史',discovery.webHistory(),'来自最近一次网页导入');
 if(id==='web-favorites')return shelf('B 站网页收藏',discovery.webFavorites(),'来自最近一次网页导入');
 if(id==='cloud-history')return cloudShelf('history');
 if(id==='cloud-folders')return cloudShelf('folders');
 if(id.startsWith('folder:'))return cloudShelf('favorites',id.slice(7));if(id==='cache-list'){await refreshCache();go('cache');return}if(id==='demo'){generation++;state.busy=false;state.mode='demo';state.items=[];state.error='';state.notice='';if(state.route==='search'&&state.query)doSearch(state.query);else draw();return}if(id==='live'){go('shelf');viewTitle='B 站热门';return loadLive()}if(id==='live-search'){state.mode='live';if(state.query)return loadLive(true);state.items=[];state.notice='';draw('query');return}if(id==='retry')return loadLive(state.route==='search');if(id.startsWith('term:'))return doSearch(id.slice(5));if(id.startsWith('video:'))return detail(id.slice(6),true);
 if(id==='danmaku-options')return showPanel('danmaku-options');
 if(id==='danmaku-switch'||id==='danmaku-curated'){
  if(id==='danmaku-switch')state.danmaku=!state.danmaku;
  else if(state.danmaku)state.curated=!state.curated;
  persist();
  draw(id);
  return;
 }
 if(id==='watch-more')return showPanel('watch-more');
 if(id==='watch-info')return detail(selected().id);
 if(id==='danmaku')return openDanmaku();
 if(id==='next-part')return changePart(state.part+1);

 if(id==='watch')return watchVideo();if(id==='parts')return showPanel('parts','part:'+state.part);if(id.startsWith('part:'))return changePart(+id.slice(5));
 if(id==='settings')return showPanel('settings');if(id==='cache-one')return showPanel('cache');if(id==='speed')return showPanel('speed');if(id==='close')return back();if(id==='download')return download();
 if(id==='mirror'){state.mirror=!state.mirror;persist();applySettings();draw('mirror');return}if(id==='subtitle'){state.subtitle=!state.subtitle;persist();applySettings();draw('subtitle');return}if(id.startsWith('rate:')){state.rate=+id.slice(5);persist();applySettings();state.panel='settings';draw('speed');return}
 if(id==='toggle'&&media?.tagName==='VIDEO'){try{if(media.paused)await media.play();else media.pause();updateMedia()}catch{state.notice='播放被浏览器阻止，请再次确认播放。';const el=document.querySelector('#bili-media-error');if(el){el.hidden=false;el.textContent=state.notice}}return}if(id==='rewind'||id==='forward'){skip(id);return}
 if(id==='fullscreen'){setImmersive(!immersive);return}

 if(id==='embed-activate'){media?.focus();return}if(id==='official-help'){state.notice='设备按键暂不能调整官方播放器的镜像、倍速和字幕。可在 B 站继续观看，或用本地样片体验适配操作。';const el=document.querySelector('#bili-media-error');if(el){el.hidden=false;el.textContent=state.notice}return}
 if(id.startsWith('offline:')){const item=samples.find(v=>v.id===id.slice(8));if(!item)return;state.selected=item;state.offline=true;state.part=1;go('player');return}if(id.startsWith('remove:')){await transaction('readwrite',s=>s.delete(id.slice(7)));await refreshCache();draw();return}
};
function changePart(part) {
  state.panel='';
  if(part===state.part){draw('parts');return;}
  const playing = media?.tagName==='VIDEO' && !media.paused;
  if(media?.tagName==='VIDEO')saveProgress(media,selected().id,state.part);
  media?.pause?.();
  state.part=part;
  if(state.route==='player')return watchVideo(false,playing || selected().mode==='official');
  draw('parts');
}
function setImmersive(enabled) {
  immersive=enabled;
  document.querySelector('.bili-watching')?.classList.toggle('bili-immersive',enabled);
  const control=document.querySelector('[data-bili-id="fullscreen"]');
  if(control){
    const label=enabled?'退出全屏':'全屏播放';
    control.innerHTML=icon(enabled?'minimize':'fullscreen');
    control.setAttribute('aria-label',label);
    control.title=label;
    focus('fullscreen');
  }
}
function skip(id) {
  if(!active() || state.route!=='player' || state.panel || media?.tagName!=='VIDEO' || !Number.isFinite(media.duration))return;
  const step=id==='rewind'?-5:5;
  media.currentTime=Math.max(0,Math.min(media.duration,media.currentTime+step));
  updateMedia();
}
let heldSkip, suppressClick;
function stopSkip() {
  if(!heldSkip)return;
  clearTimeout(heldSkip.timer);
  clearInterval(heldSkip.interval);
  heldSkip=null;
}
function startSkip(id, input, stepOnPress) {
  stopSkip();
  if(stepOnPress)skip(id);
  heldSkip={input,id,timer:setTimeout(()=>{
    if(input==='pointer')suppressClick={id,at:performance.now()};
    skip(id);
    heldSkip.interval=setInterval(()=>skip(id),180);
  },350)};
}
function skipTarget(target) {
  return target.closest?.('.bili-watching [data-bili-id="rewind"], .bili-watching [data-bili-id="forward"]')?.dataset.biliId;
}
window.addEventListener('keydown',event=>{
  if(!active()||state.panel||!['Enter',' '].includes(event.key))return;
  const id=skipTarget(event.target);
  if(!id)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!event.repeat)startSkip(id,'key',true);
},true);
window.addEventListener('keyup',event=>{
  if(heldSkip?.input==='key'&&['Enter',' '].includes(event.key))stopSkip();
},true);
window.addEventListener('pointerdown',event=>{
  const id=skipTarget(event.target);
  if(!id||event.button!==0||!active()||state.panel)return;
  suppressClick=null;
  startSkip(id,'pointer',false);
},true);
window.addEventListener('pointerup',()=>{if(heldSkip?.input==='pointer'){if(suppressClick)suppressClick.at=performance.now();stopSkip();}},true);
window.addEventListener('pointercancel',stopSkip,true);
window.addEventListener('blur',stopSkip);
window.addEventListener('click',event=>{
  if(suppressClick&&suppressClick.id===skipTarget(event.target)&&performance.now()-suppressClick.at<350){
    suppressClick=null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
},true);

window.BilibiliService={scope,back,open(){state.panel='';osNavigate('bilibili');requestAnimationFrame(()=>{if(active())window.LegoGamepad?.refreshFocus(true)})},snapshot(){return {route:state.route,mode:state.mode,panel:state.panel,mirror:state.mirror,rate:state.rate,subtitle:state.subtitle,offline:state.offline}}};
window.LegoHandoffs?.entries.push({id:'bilibili',name:'Bilibili',glyph:'play'});
const nav=osNavigate;osNavigate=function(page){if(active()&&page!=='bilibili'){stopPoll();remember();media?.pause?.()}return nav(page)};
document.addEventListener('DOMContentLoaded',()=>{if(!osData)bootOS()},{once:true});
if(new URLSearchParams(location.search).get('service')==='bilibili'){const auto=setInterval(()=>{if(osData){clearInterval(auto);window.BilibiliService.open()}},100)}
})();
