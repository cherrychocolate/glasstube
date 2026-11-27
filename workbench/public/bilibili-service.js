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
let feed = {items:[], categories:new Map(), busy:false, error:''};
const CATEGORY_BATCH = 5;
let searchSession = {query:'',mode:'live',items:[],error:'',notice:''};
let viewTitle = '', account = 'disconnected', qr = '', pollTimer, stream = null;
let loginMessage = '';
let dashPlayer = null;
let loginAttempt = 0, loginBusy = false;
const read=()=>{try{return JSON.parse(localStorage.getItem('lego-bilibili-v1')||'{}')}catch{return {}}};
const saved=read();let state={route:'home',panel:'',mode:'demo',items:samples,query:'',selected:samples[0],busy:false,error:'',notice:'',rate:[.5,.75,1,1.25,1.5,2].includes(saved.rate)?saved.rate:1,mirror:!!saved.mirror,subtitle:saved.subtitle!==false,danmaku:!!saved.danmaku,curated:!!saved.curated,history:saved.history||{},cache:[],cacheBusy:false,cacheError:'',offline:false,part:1};
let media=null,mediaID='',mediaURL='',generation=0,lastSave=0;const stack=[],focusMemory=new Map(),scrollMemory=new Map(),browseHeights=new Map();
function persist(){try{localStorage.setItem('lego-bilibili-v1',JSON.stringify({rate:state.rate,mirror:state.mirror,subtitle:state.subtitle,danmaku:state.danmaku,curated:state.curated,history:state.history}))}catch{state.notice='浏览器未能保存观看设置。'}}
const scope=()=>state.route+':'+(['shelf','topic'].includes(state.route)?viewTitle+':':'')+state.panel;
const active=()=>osPage==='bilibili';
const button=(id,label,extra='')=>`<button type="button" data-bili-id="${H(id)}" ${extra}>${H(label)}</button>`;
const icons = {
  play:'<path d="m9 5 12 7-12 7Z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M9 5v14M16 5v14" stroke-width="3"/>',
  rewind:'<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
  forward:'<path d="M20 10a8 8 0 1 0-2 8m2-14v6h-6"/>',
  heart:'<path d="M20.8 8.6c0 4.2-8.8 9.4-8.8 9.4S3.2 12.8 3.2 8.6a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z"/>',
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
const scrollArea=()=>document.querySelector('.bili-browse-scroll')||document.querySelector('.bili-body');
function remember(){if(!active())return;const key=document.activeElement?.dataset?.biliId;if(key)focusMemory.set(scope(),key);scrollMemory.set(scope(),scrollArea()?.scrollTop||0)}
function focus(id){const el=[...document.querySelectorAll('.bili-app [data-bili-id]')].find(e=>e.dataset.biliId===id&&!e.disabled&&!e.closest('[inert]'));if(el&&!window.LegoGamepad?.focusElement?.(el)){document.querySelectorAll('.device-focus').forEach(e=>e.classList.remove('device-focus'));el.classList.add('device-focus');el.focus({preventScroll:true});el.scrollIntoView({block:'nearest'});}}
function draw(defaultID){
  renderOS();
  requestAnimationFrame(()=>{
    if(!active())return;
    const available = [...document.querySelectorAll('.bili-app [data-bili-id]')]
      .filter(element => !element.disabled && !element.closest('[inert]') && element.getClientRects().length);
    const target = available.find(element => element.dataset.biliId === (defaultID || focusMemory.get(scope()))) ||
      available.find(element => element.hasAttribute('data-focus-default')) || available[0];
    if(target)focus(target.dataset.biliId);
  });
}
function go(route, render = true, origin){if(state.route==='search'){const {query,mode,items,error,notice}=state;searchSession={query,mode,items,error,notice};}generation++;state.busy=false;remember();stack.push({focus:origin||focusMemory.get(scope()),route:state.route,selected:state.selected,part:state.part,items:state.items,query:state.query,mode:state.mode,offline:state.offline,viewTitle,stream,folders:state.folders,error:state.error,notice:state.notice});state.route=route;state.panel='';state.error='';state.notice='';if(route!=='player')media?.pause?.();if(render)draw();}
function back(){if(!active())return false;if(immersive&&!state.panel){setImmersive(false);return true;}if(state.panel){if(state.panel==='danmaku'){state.panel='danmaku-options';draw('danmaku');return true}if(state.panel==='login')stopPoll();if(state.panel==='library-tools'){state.panel='';draw('library-tools');return true;}if(state.panel==='danmaku-options'){state.panel='settings';draw('danmaku-options');return true;}state.panel='';draw(focusMemory.get(scope())||'settings');return true}if(stack.length){if(state.route==='player'&&!state.busy&&media?.tagName==='VIDEO')saveProgress(media,selected().id,state.part);generation++;state.busy=false;remember();media?.pause?.();const {focus:origin,...previous}=stack.pop();Object.assign(state,previous);viewTitle=previous.viewTitle;stream=previous.stream;draw(origin);return true}osNavigate('center');return true}
function showPanel(panel, initialFocus){remember();state.panel=panel;draw(initialFocus)}
async function request(path,post=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9500);try{const r=await fetch('/api/bilibili/'+path,{signal:controller.signal,cache:'no-store',...(post?{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'读取失败');return d}finally{clearTimeout(timer)}}
async function loadSearch(){const gen=++generation;state.mode='live';state.busy=true;state.error='';state.items=[];draw();try{const data=await request('search?q='+encodeURIComponent(state.query));if(gen!==generation)return;state.items=data.items;state.notice=''}catch(e){if(gen!==generation)return;state.error=e.name==='AbortError'?'读取超时，请重试。':e.message;const query=state.query.normalize('NFKC').toLowerCase();
const loaded=[...feed.items,...[...feed.categories.values()].flatMap(category=>category.items)];
const matches=loaded.filter(video=>[video.title,video.author,video.topic,video.id]
  .some(field=>String(field||'').normalize('NFKC').toLowerCase().includes(query)));
state.items=[...new Map([...discovery.search(state.query),...matches].map(video=>[video.id,video])).values()];
if(state.items.length){state.error='';state.notice='实时搜索暂不可用，以下是已加载视频中的匹配结果。';}}finally{if(gen===generation){state.busy=false;if(active())draw()}}}
const isFeed = () => ['home','featured','topics'].includes(state.route);
async function refreshFeed() {
  if (feed.busy) return;
  remember();
  feed.busy = true;
  feed.error = '';
  draw();
  try {
    const data = await request('home');
    feed.items = [...new Map(data.items.map(video => [video.id, video])).values()];
    feed.categories = new Map();
    for (const video of data.categoryItems || data.items) {
      const topic = video.topic || '其他';
      if (!feed.categories.has(topic)) feed.categories.set(topic,{items:[],count:CATEGORY_BATCH,page:data.categoryPage??null});
      const shelf = feed.categories.get(topic);
      if (!shelf.items.some(item=>item.id===video.id)) shelf.items.push(video);
    }
    if (data.stale) feed.error='暂时无法读取实时热门，正在显示最近保存的热门列表。';
  } catch (error) {
    feed.error = error.name === 'AbortError' ? '读取 B 站热门超时' : error.message;
  } finally {
    feed.busy = false;
    if (active() && isFeed()) { remember(); draw(); }
  }
}
function relatedVideos() {
  const video = selected();
  return (video.related?.length ? video.related : video.mode==='demo'?samples:feed.items)
    .filter(item => item.id !== video.id).slice(0,20);
}
function cardVideo(key) {
  const id = key.split(':').at(-1);
  if (key.startsWith('topic-video:')) return topicPages.get(viewTitle)?.items.find(video=>video.id===id);
  if (key.startsWith('library:')) return catalog(id);
  if (key.startsWith('related:')) return relatedVideos().find(video => video.id === id);
  if (key.startsWith('category:')) return feed.categories.get(key.slice(9,key.lastIndexOf(':')))?.items.find(video=>video.id===id);
  if (key.startsWith('hot:')) return feed.items.find(video => video.id === id);
  return state.items.find(video => video.id === id) || catalog(id);
}
let menuVideo;
function openCardMenu(target) {
  const video = cardVideo(target.dataset.biliId);
  if (!video) return false;
  menuVideo = video;
  focus(target.dataset.biliId);
  showPanel('card-menu','menu-watch');
  return true;
}
function openRecommendation(id) {
  return detail(id, true, relatedVideos().find(video => video.id === id), true);
}
async function detail(id, direct = false, recommendation, replace = false) {
  const item = recommendation || state.items.find(x=>x.id===id) || feed.items.find(x=>x.id===id) || discovery.find(id) || samples.find(x=>x.id===id);
  if (!item) return;
  if (state.route === 'player') {
    if (media?.tagName === 'VIDEO') saveProgress(media, selected().id, state.part);
    release();
    immersive = false;
  }
  if (replace) {
    generation++;
    state.panel = '';
    state.error = '';
    state.notice = '';
    scrollMemory.delete(scope());
  } else {
    go(direct ? 'player' : 'detail', false);
  }
  state.selected = {...item};
  state.part = discovery.resume(id,state.history)?.part || 1;
  state.offline = false;
  stream = null;
  state.busy = direct && item.mode==='official';
  autoStart = direct;
  draw(direct ? 'toggle' : 'watch');
  if (item.mode !== 'official') return;
  const gen = ++generation;
  const q = encodeURIComponent(id);
  request('related?id='+q).then(result => {
    if (selected().id !== id || !['detail','player'].includes(state.route)) return;
    state.selected.related = result.items;
    const track = document.querySelector('#bili-related');
    if (track && result.items.length) {
      const focused = document.activeElement?.dataset.biliId;
      const wasFocused = track.contains(document.activeElement);
      track.outerHTML = recommendationShelf();
      if (wasFocused) focus(relatedVideos().some(video => 'related:'+video.id===focused) ?
        focused : document.querySelector('#bili-related [data-bili-id]')?.dataset.biliId || 'back');
    }
  }).catch(() => {});
  const [metadata, parts] = await Promise.allSettled([request('video?id='+q), request('parts?id='+q)]);
  if (gen !== generation) return;
  const next = {...state.selected, ...(metadata.value?.item || {})};
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
  else remember();
  autoStart = autoplay;
  state.notice = '';
  if (state.route==='player' && selected().mode!=='demo') release();
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
    if (gen === generation) state.notice = '暂时无法加载播放源，请重试。';
  } finally {
    if (gen === generation) {
      state.busy = false;
      draw(state.panel ? undefined : stream ? 'toggle' : 'retry-play');
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
function cards(items, prefix = 'video:') {
  return items.map((video,index)=>{
    const resume=discovery.resume(video.id,state.history);
    const hasProgress=resume&&!resume.finished&&resume.position>1;
    const total=typeof video.duration==='number'?video.duration:0;
    const percent=hasProgress&&total>0&&(video.parts?.length||1)===1?
      Math.min(100,Math.floor(100*resume.position/total)):0;
    const art=coverArt(video.cover || discovery.find(video.id)?.cover,video.mode==='demo'?'':video.id,
      typeof video.duration==='string'&&/^\d+(?::\d{2}){1,2}$/.test(video.duration)?video.duration:video.duration>0?time(video.duration):'',video.parts?.length||0,percent);
    return `<button type="button" class="bili-video-card" data-bili-id="${H(prefix+video.id)}" ${prefix==='video:'&&index===0?'data-focus-default':''}>
      ${art}
      <span class="bili-card-copy"><strong>${H(video.title)}</strong><small>${H(video.author ? 'UP '+video.author : '')}${video.topic&&video.topic!=='未分类'?' · '+H(video.topic):''}</small>
      ${hasProgress||discovery.hasLater(video.id)?`<span class="bili-card-badges">${hasProgress?`<em>P${resume.part||1} · 已看至 ${time(resume.position)}</em>`:''}
      ${discovery.hasLater(video.id)?'<em>稍后看</em>':''}</span>`:''}</span>
    </button>`;
  }).join('');
}
function currentSection() {
  return ({home:'recent',featured:'featured',topics:'topics',connect:'connect',search:'search'})[state.route];
}
function sectionBar(selectedTab) {
  const tabs=[['recent','首页'],['featured','为你推荐'],['topics','主题'],['connect','片库'],['search','搜索']];
  return `<nav class="bili-section-bar" aria-label="B 站服务">
    ${tabs.map(([id,label])=>button(id,label,id===selectedTab?'aria-current="page" data-focus-default':'')).join('')}
  </nav>`;
}
function header(title,sub=''){return `<header class="bili-head"><div><small>bilibili / LEGO OS</small><h1>${H(title)}</h1></div>${iconButton('back','返回上一页','back')}</header>${sub?`<p class="bili-kicker">${H(sub)}</p>`:''}`}
function status(){return `${state.busy?'<p role="status" class="bili-note">正在读取 B 站公开内容…</p>':''}${state.error?`<div class="bili-alert" role="status">${H(state.error)}${button('retry','重新读取')}</div>`:''}${state.notice?`<p class="bili-note" role="status">${H(state.notice)}</p>`:''}`}
function feedStatus() {
  return `<div class="bili-feed-status">
    ${feed.error?`<span role="status">${H(feed.error)}</span>`:''}
    ${!feed.busy&&!feed.error&&!feed.items.length?'<span role="status">暂时没有热门视频</span>':''}</div>`;
}
function videoShelf(title, items, prefix, id = '') {
  return `<section class="bili-glass-shelf" ${id?`id="${id}"`:''}><h3>${H(title)} <span>${items.length}</span></h3>
    ${items.length?`<div class="bili-track">${cards(items,prefix)}</div>`:'<p class="bili-feed-empty">暂无视频</p>'}</section>`;
}
function topicGroups() {
  return [...feed.categories].map(([topic,shelf])=>[topic,shelf.items]);
}
function categoryShelf(topic, shelf) {
  const visible = shelf.items.slice(0,shelf.count);
  return `<section class="bili-glass-shelf" data-category="${H(topic)}"><h3>${H(topic)} <span>${visible.length}</span></h3>
    <div class="bili-track">${cards(visible,'category:'+topic+':')}</div>
    <p class="bili-category-status" role="status"></p></section>`;
}
async function extendCategory(section, focused) {
  const topic = section.dataset.category;
  const shelf = feed.categories.get(topic);
  if (!shelf || shelf.loading) return;
  const track = section.querySelector('.bili-track');
  const status = section.querySelector('.bili-category-status');
  const start = shelf.count;
  const canLoad = () => shelf.page !== null;
  shelf.loading = true;
  status.textContent = '正在加载更多…';
  let failed = false;
  let stale = false;
  try {
    while (canLoad()) {
      const result = await request('category?'+new URLSearchParams({topic,page:shelf.page}));
      if (feed.categories.get(topic)!==shelf) return;
      const existing = new Set(shelf.items.map(video=>video.id));
      const fresh = result.items.filter(video=>{
        if ((video.topic||'其他')!==topic || existing.has(video.id)) return false;
        existing.add(video.id);
        return true;
      });
      // Newly fetched videos follow the current last card. Any reserve stays available.
      shelf.items.splice(start,0,...fresh);
      stale ||= !!result.stale;
      shelf.page = result.nextPage ?? null;
      if (shelf.items.length > start) break;
    }
  } catch {
    failed = true;
  } finally {
    shelf.loading = false;
  }
  if (feed.categories.get(topic)!==shelf) return;
  const added = shelf.items.slice(start,start+CATEGORY_BATCH);
  shelf.count += added.length;
  if (!section.isConnected) return;
  const advance = document.activeElement===focused;
  if (added.length) {
    track.insertAdjacentHTML('beforeend',cards(added,'category:'+topic+':'));
    section.querySelector('h3 span').textContent = shelf.count;
    status.textContent = stale?'已追加保存的视频':'';
    if (advance) focus('category:'+topic+':'+added[0].id);
  } else {
    status.textContent = failed?'加载失败，再按右键重试。':'没有更多视频。';
  }
}
document.addEventListener('keydown', event=>{
  if (!['ArrowLeft','ArrowRight'].includes(event.key) || state.route!=='home' || state.panel) return;
  const card = event.target.closest?.('[data-bili-id^="category:"]');
  const section = card?.closest('[data-category]');
  if (!section) return;
  const right = event.key==='ArrowRight';
  const neighbor = right?card.nextElementSibling:card.previousElementSibling;
  if (!right && !neighbor) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (neighbor) focus(neighbor.dataset.biliId);
  else if (!event.repeat) void extendCategory(section,card);
},true);
function home() {
  const recent=discovery.recent(state.history).map(catalog).filter(Boolean);
  return (recent.length?videoShelf('继续观看',recent,'video:'):'') +
    feedStatus() + videoShelf('B 站热门',feed.items, 'hot:') +
    [...feed.categories].filter(([,shelf])=>shelf.items.length>=CATEGORY_BATCH)
      .map(([topic,shelf])=>categoryShelf(topic,shelf)).join('');
}
function featured() {
  const [hero,...rest] = feed.items;
  return (hero?`<button class="bili-hero" data-bili-id="hot:${H(hero.id)}">${coverArt(hero.cover,hero.id)}
    <span class="bili-hero-copy"><small>B 站热门</small><strong>${H(hero.title)}</strong><span>${H(hero.author)}</span></span>
    </button><h3 class="bili-section-label">更多推荐</h3><div class="bili-list bili-video-list">${cards(rest,'hot:')}</div>`:'') + feedStatus();
}
function shelfView() {
  return `${header(viewTitle)}${status()}<div class="bili-list bili-video-list">${cards(state.items)}</div>
    ${!state.busy&&!state.items.length&&!state.notice?'<p class="bili-note">这里暂时没有视频。</p>':''}`;
}
const TOPIC_CACHE_KEY = 'glasstube-topic-videos-v1';
const topicPages = new Map();
try {
  const cached = JSON.parse(localStorage.getItem(TOPIC_CACHE_KEY)||'[]');
  for (const [topic,items] of cached) {
    if(typeof topic==='string'&&Array.isArray(items)) topicPages.set(topic,{items:items.filter(video=>typeof video?.id==='string'),page:1,reserve:[]});
  }
} catch { /* Topic loading still works without browser storage. */ }
function saveTopic(topic, data) {
  topicPages.delete(topic);
  topicPages.set(topic,data);
  try {
    const visible = [...topicPages].filter(([,entry])=>entry.items.length).slice(-12);
    localStorage.setItem(TOPIC_CACHE_KEY,JSON.stringify(visible.map(([name,entry])=>[name,entry.items.slice(0,25)])));
  } catch { /* Keep the topic available in this session. */ }
}
function topicsView() {
  const topics = new Map(topicGroups());
  for(const [topic,entry] of topicPages) if(!topics.has(topic)&&entry.items.length) topics.set(topic,entry.items);
  return `<div class="bili-topic-grid">${[...topics].map(([topic,videos],index)=>
    `<button class="bili-topic-tile" style="--h:${(205+index*47)%360}" data-bili-id="topic:${H(topic)}">
      <span>${icon('discover')}</span><span>${H(topic)}<small>${videos.length} 个视频</small></span></button>`).join('')}</div>${feedStatus()}`;
}
function topicView() {
  const data = topicPages.get(viewTitle);
  return `<header class="bili-head bili-topic-heading">${iconButton('back','返回上一页','back','data-focus-default')}
    <span>主题</span><h1>${H(viewTitle)}</h1></header>
    <div class="bili-list bili-video-list" id="bili-topic-results">${cards(data.items,'topic-video:')}</div>
    <p class="bili-category-status bili-topic-status" id="bili-topic-status" role="status">${H(data.message||'')}</p>`;
}
function openTopic(topic) {
  const cached = topicPages.get(topic)?.items;
  const items = cached?.length ? cached : feed.categories.get(topic)?.items.slice(0,CATEGORY_BATCH)||[];
  const data = {items,page:1,reserve:[],needsRefresh:true};
  topicPages.set(topic,data);
  go('topic',false);
  viewTitle = topic;
  scrollMemory.delete(scope());
  draw('back');
  void loadTopic(topic);
}
async function loadTopic(topic, moveFrom) {
  const data = topicPages.get(topic);
  const viewing = () => active() && state.route==='topic' && viewTitle===topic && !state.panel;
  const setStatus = message => {
    data.message = message;
    const status = viewing() && document.querySelector('#bili-topic-status');
    if (status) status.textContent = message;
  };
  if (!data || data.loading) return;
  if (data.page===null&&!data.reserve.length) { setStatus(data.items.length?'没有更多视频。':'暂无视频。'); return; }
  if (!navigator.onLine) { setStatus('当前离线，已保留现有列表。'); return; }
  const refresh = data.needsRefresh;
  data.loading = true;
  setStatus(refresh?'正在刷新主题…':'正在加载更多…');
  const existing = new Set(refresh?[]:data.items.map(video=>video.id));
  const reserve = refresh?[]:[...data.reserve];
  for (const video of reserve) existing.add(video.id);
  let page = refresh?1:data.page;
  try {
    while (reserve.length<CATEGORY_BATCH && page!==null) {
      const response = await request('category?'+new URLSearchParams({topic,page}));
      if (topicPages.get(topic)!==data) return;
      if (!navigator.onLine || response.stale) throw Error('offline');
      for (const video of response.items) {
        if ((video.topic||'其他')!==topic || existing.has(video.id)) continue;
        existing.add(video.id);
        reserve.push(video);
      }
      page = Number.isInteger(response.nextPage)&&response.nextPage>page?response.nextPage:null;
    }
    const added = reserve.splice(0,CATEGORY_BATCH);
    const previous = data.items;
    data.items = refresh && added.length ? added : [...previous,...added];
    data.reserve = reserve;
    data.page = page;
    data.needsRefresh = false;
    saveTopic(topic,data);
    setStatus(added.length?'':data.items.length?'没有更多视频。':'暂无视频。');
    const list = viewing() && document.querySelector('#bili-topic-results');
    if (!list || !added.length) return;
    const activeCard = list.contains(document.activeElement) ? document.activeElement.dataset.biliId : '';
    const markup = cards(added,'topic-video:');
    if (refresh) list.innerHTML = markup;
    else list.insertAdjacentHTML('beforeend',markup);
    loadVisibleCovers(scrollArea());
    if ((refresh&&activeCard) || (moveFrom&&document.activeElement===moveFrom)) {
      const match = refresh&&added.find(video=>'topic-video:'+video.id===activeCard);
      focus('topic-video:'+(match||added[0]).id);
    }
  } catch {
    if(topicPages.get(topic)===data) setStatus(navigator.onLine?'主题读取失败，已保留现有列表。':'当前离线，已保留现有列表。');
  } finally {
    data.loading = false;
  }
}
function bindTopicScroll(body) {
  const atEnd = () => body.scrollHeight-body.clientHeight-body.scrollTop<=12;
  const loadAtEnd = () => {
    if (body.isConnected && !state.panel && atEnd()) void loadTopic(viewTitle);
  };
  let previous = body.scrollTop, touchY;
  body.addEventListener('scroll',()=>{
    const current = body.scrollTop;
    if (current>previous) loadAtEnd();
    previous = current;
  },{passive:true});
  body.addEventListener('wheel',event=>{if(event.deltaY>0)loadAtEnd();},{passive:true});
  body.addEventListener('touchstart',event=>{touchY=event.touches[0]?.clientY;},{passive:true});
  body.addEventListener('touchend',event=>{
    if(touchY-event.changedTouches[0]?.clientY>24)loadAtEnd();
    touchY=undefined;
  },{passive:true});
}
document.addEventListener('keydown',event=>{
  if(event.key!=='ArrowDown'||state.route!=='topic'||state.panel) return;
  const card=event.target.closest?.('#bili-topic-results [data-bili-id]');
  if(!card || card.nextElementSibling) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!event.repeat) void loadTopic(viewTitle,card);
},true);
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
  const results = state.items.length
    ? `<h2 class="bili-section-label">${state.items.length} 个结果</h2><div class="bili-list bili-video-list">${cards(state.items)}</div>`
    : !state.busy&&!state.error
      ? `<p class="bili-feed-empty">${state.query?`没有找到“${H(state.query)}”`:'搜索标题、UP 主、话题或 BV 号。'}</p>` : '';
  return `<form id="bili-search-form" class="bili-search-box" role="search">
      <button class="bili-icon-button" data-bili-id="submit" type="submit" aria-label="提交搜索">${icon('search')}</button>
      <input type="search" data-bili-id="query" aria-label="搜索视频" name="query" maxlength="80"
        placeholder="搜索标题、UP 主或 BV 号" value="${H(state.query)}" autocomplete="off" spellcheck="false" enterkeyhint="search">
    </form>
    <div class="bili-glass-chips" aria-label="快捷搜索">${['动画','科技','学习','游戏','音乐'].map(q=>button('term:'+q,q)).join('')}</div>
    <div class="bili-glass-chips bili-search-sources" aria-label="搜索范围">
      ${button('live-search','B 站',`aria-pressed="${state.mode==='live'}"`)}
      ${button('demo','本机片库',`aria-pressed="${state.mode==='demo'}"`)}
    </div>
    ${status()}${results}`;
}
function details(){const v=selected(),pos=discovery.resume(v.id,state.history)?.finished?0:discovery.resume(v.id,state.history)?.position||0;return `${header('视频详情',v.mode==='demo'?'本地交互样片 · 非 B 站内容':'B 站视频')}<div class="bili-detail-art tone-${v.tone||'blue'}"><span>▶</span><small>${v.mode==='demo'?'LOCAL PLAYBACK TEST':H(v.id)}</small></div><h2 class="bili-title">${H(v.title)}</h2><p class="bili-author">${H(v.author)}</p><div class="bili-actions">${button('watch',pos>1?'继续播放 '+time(pos):'开始观看','data-focus-default')}${button('parts','选集 · '+(v.parts?.length||1))}${button('save-later',discovery.hasLater(v.id)?'取消稍后看':'稍后看',`aria-pressed="${discovery.hasLater(v.id)}"`)}</div><p class="bili-description">${H(v.description||'此视频暂未提供简介。')}</p>${status()}`}
let danmakuItems = [], danmakuStatus = '', danmakuAt = 0;
const DANMAKU_TRAVEL = 7, FIXED_TIME = 4;
const commentTracks = new Map();
let overlay = null, frame = 0;

function commentsForPart() {
  const key = selected().id + ':' + state.part;
  if (!commentTracks.has(key)) {
    if (commentTracks.size >= 8) commentTracks.delete(commentTracks.keys().next().value);
    const data = {items:[], error:''};
    commentTracks.set(key, data);
    request('danmaku?id='+encodeURIComponent(selected().id)+'&page='+state.part+'&all=1')
      .then(result => { data.items = result.items; })
      .catch(() => { data.error = '弹幕暂不可用'; })
      .finally(() => updateOverlay());
  }
  return commentTracks.get(key);
}
function clearOverlay() {
  cancelAnimationFrame(frame);
  frame = 0;
  overlay?.layer.replaceChildren();
  overlay = null;
}
function updateOverlay() {
  cancelAnimationFrame(frame);
  frame = 0;
  const layer = document.querySelector('#bili-danmaku-overlay');
  const status = document.querySelector('#bili-danmaku-status');
  if (!layer || !state.danmaku || !stream || state.busy || media?.tagName !== 'VIDEO') {
    clearOverlay();
    if (status) status.textContent = '';
    return;
  }
  const data = commentsForPart();
  if (status) status.textContent = data.error;
  const t = media.currentTime || 0;
  const width = layer.clientWidth;
  const laneCount = Math.max(1, Math.floor(layer.clientHeight * .42 / 32));
  if (!overlay || overlay.layer !== layer || overlay.items !== data.items ||
      overlay.width !== width || overlay.laneCount !== laneCount || t < overlay.last || t-overlay.last > 1) {
    clearOverlay();
    let low = 0, high = data.items.length;
    while (low < high) {
      const mid = Math.floor((low+high)/2);
      if (data.items[mid].at < t-DANMAKU_TRAVEL) low = mid+1;
      else high = mid;
    }
    overlay = {layer, items:data.items, width, laneCount, index:low, last:t, visible:[]};
  }
  const view = overlay;
  view.last = t;
  view.visible = view.visible.filter(comment => {
    if (t < comment.end) return true;
    comment.node.remove();
    return false;
  });
  const speed = width / DANMAKU_TRAVEL;
  while (view.index < data.items.length && data.items[view.index].at <= t) {
    const item = data.items[view.index++];
    const mode = item.mode === 4 ? 'bottom' : item.mode === 5 ? 'top' : item.mode === 6 ? 'reverse' : 'scroll';
    const fixed = mode === 'top' || mode === 'bottom';
    const text = item.text.replace(/[\s\p{P}]/gu,'');
    if (state.curated && (text.length < 5 || view.visible.length >= 3 ||
        view.visible.some(comment => comment.text === text))) continue;
    const node = document.createElement('span');
    node.className = 'bili-danmaku-comment';
    node.textContent = item.text;
    node.style.fontSize = Math.min(28,item.size) + 'px';
    node.style.color = '#' + item.color.toString(16).padStart(6,'0');
    layer.append(node);
    const textWidth = node.offsetWidth;
    const end = item.at + (fixed ? FIXED_TIME : DANMAKU_TRAVEL + textWidth/Math.max(1,speed));
    const lane = Array.from({length:laneCount}, (_, i) => i).find(i =>
      !view.visible.some(previous => previous.lane === i &&
        (mode === 'bottom') === (previous.mode === 'bottom') &&
        (fixed || previous.mode !== mode ? previous.end > item.at :
          speed*(item.at-previous.at) < (mode==='reverse'?textWidth:previous.width)+24)));
    if (end <= t || lane === undefined) { node.remove(); continue; }
    node.style[mode==='bottom'?'bottom':'top'] = (mode==='bottom'?48:12) + lane*32 + 'px';
    view.visible.push({node, lane, at:item.at, end, width:textWidth, mode, text});
  }
  for (const comment of view.visible) {
    const distance = speed*(t-comment.at);
    const x = comment.mode==='scroll' ? width-distance : comment.mode==='reverse' ?
      distance-comment.width : (width-comment.width)/2;
    comment.node.style.transform = `translateX(${x}px)`;
  }
  if (!media.paused && !media.ended) frame = requestAnimationFrame(updateOverlay);
}
async function openDanmaku() {
  danmakuAt = media?.currentTime || 0;
  danmakuItems = [];
  danmakuStatus = '正在读取本集弹幕…';
  showPanel('danmaku');
  const gen = generation;
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
function panel(){const p=state.panel;if(!p)return '';let title='',body='';if(p==='settings'){title='播放设置';body=button('mirror','镜像 · '+(state.mirror?'开':'关'),`aria-pressed="${state.mirror}"`)+button('speed','倍速 · '+state.rate+'×')+button('subtitle','字幕 · '+(state.subtitle?'开':'关'),`aria-pressed="${state.subtitle}"`)+button('cache-one','离线缓存入口')+(selected().mode!=='demo'?button('danmaku-options','弹幕设置'):'')+(stream&&!stream.captionCues.length?'<p>此视频暂无可用字幕。</p>':'');}
 if(p==='library-tools'){title='片库管理';body=libraryTools();}
 if(p==='card-menu'){
  title=menuVideo.title;
  body=button('menu-watch','播放')+button('menu-later',discovery.hasLater(menuVideo.id)?'取消稍后看':'稍后看')+
    button('menu-like',discovery.hasLike(menuVideo.id)?'取消点赞':'点赞');
 }
 if(p==='danmaku-options'){
  title='弹幕';
  body=button('danmaku-switch',state.danmaku?'弹幕 · 开':'弹幕 · 关',`aria-pressed="${state.danmaku}"`)+
    button('danmaku-curated',state.curated&&state.danmaku?'精选弹幕 · 开':'精选弹幕 · 关',state.danmaku?`aria-pressed="${state.curated}"`:'disabled aria-pressed="false"')+
    (state.danmaku?'<p>精选在设备端过滤过短、重复的发言，并降低显示密度。</p>':'')+
    button('danmaku','查看附近弹幕',state.busy?'disabled':'');
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

 if(p==='cache'){title='离线缓存';body=selected().mode==='demo'?`<p>保存此 30 秒本地样片，用于验证离线播放。包含镜像、倍速及字幕体验。</p><p role="status" id="bili-cache-status">${state.cacheBusy?'正在写入浏览器存储…':H(state.cacheError||'这不会下载任何 B 站视频。')}</p>${state.cacheBusy?'':button('download','保存样片供离线观看')}`:`<p>离线缓存支持本地样片。</p>`;}
 if(p==='login'){
  title='连接 B 站账号';
  body=`<p id="bili-qr-note" role="status">${H(loginMessage)}</p>${qr?`<img class="bili-qr" alt="哔哩哔哩扫码登录" src="${H(qr)}">`:''}${loginBusy?'':button('login','重新生成二维码')}`;
 }
 return `<div class="bili-scrim"><section class="bili-sheet" role="dialog" aria-modal="true" aria-label="${H(title)}"><h2>${H(title)}</h2><div class="bili-sheet-items">${body}${button('close','关闭')}</div></section></div>`}
function episodeShelf(video) {
  const parts = video.parts || [];
  if (parts.length < 2) return '';
  return `<section class="bili-glass-shelf"><h3>选集 <span>${parts.length}</span></h3><div class="bili-track bili-episode-track">
    ${parts.map(part=>`<button class="bili-part" type="button" data-bili-id="part:${part.page}" aria-pressed="${part.page===state.part}">
      <small>P${part.page}</small><strong>${H(part.title)}</strong></button>`).join('')}</div></section>`;
}
function recommendationShelf() {
  return videoShelf('接下来播放', relatedVideos(), 'related:', 'bili-related');
}
function player() {
  const video = selected();
  const demo = video.mode === 'demo';
  const native = demo || !!stream;
  const part = video.parts?.find(item => item.page === state.part);
  const heading = part && video.parts.length > 1 ? 'P'+state.part+' · '+part.title : video.title;
  const transportState = native ? '' : 'disabled';
  const controls = `
    <div class="bili-transport" aria-label="播放控制">
      ${iconButton('rewind','后退 10 秒','rewind',transportState,'10')}
      ${iconButton('toggle','播放或暂停','play',native?'data-focus-default':'disabled')}
      ${iconButton('forward','前进 10 秒','forward',transportState,'10')}
      ${!demo?iconButton('danmaku-switch','弹幕开关','chat',`aria-pressed="${state.danmaku}"`):''}
      ${iconButton('settings','播放设置','settings')}
      ${iconButton('save-like',discovery.hasLike(video.id)?'取消点赞':'点赞','heart',`aria-pressed="${discovery.hasLike(video.id)}"`)}
      ${button('save-later',discovery.hasLater(video.id)?'取消稍后看':'稍后看',`class="bili-watch-later" aria-pressed="${discovery.hasLater(video.id)}"`)}
      ${iconButton('fullscreen',immersive?'退出全屏':'全屏播放',immersive?'minimize':'fullscreen')}
    </div>`;
  return `<header class="bili-watch-heading">${iconButton('back','返回上一页','back')}
      <span>正在播放</span><strong>${H(video.author)}</strong>
    </header>
    <div class="bili-video-stage" role="region" aria-label="GlassTube 播放器">
      ${!native?`<div class="bili-play-poster">${coverArt(video.cover,video.id)}</div>`:''}
      <div class="bili-media-mount"></div>
      <div id="bili-danmaku-overlay" aria-hidden="true"></div>
      ${native?'<div id="bili-captions" class="bili-captions" hidden></div>':''}
      <p class="bili-play-status" id="bili-play-status" role="status">${state.busy?'正在加载…':!native?'播放源暂不可用':''}</p>
    </div>
    ${native?'<p class="bili-watch-meta"><progress id="bili-progress-bar" max="1" value="0" aria-label="播放进度"></progress><span id="bili-time"></span></p>':''}
    <div class="bili-watch-info"><h1>${H(heading)}</h1><p>${H(video.author)}${video.topic?' · '+H(video.topic):''}</p></div>
    ${controls}
    <p id="bili-danmaku-status" role="status"></p>
    ${!native && !state.busy?`<div class="bili-play-recovery"><span role="status">${H(state.notice||'暂时无法加载播放源。')}</span>${button('retry-play','重试播放','data-focus-default')}</div>`:''}
    <p id="bili-media-error" class="bili-alert" role="status" hidden></p>
     ${episodeShelf(video)}
    ${video.description?`<p class="bili-watch-description">${H(video.description)}</p>`:''}
    ${recommendationShelf()}`;
}
function cacheView(){return `${header('离线缓存','仅显示已校验的本地样片')}<p class="bili-note">${H(state.cacheError||'本地缓存不等于 B 站 App 离线视频；B站内容缓存需单独能力。')}</p><div class="bili-list">${state.cache.length?state.cache.map(c=>`<section class="bili-cache-card"><h2>${H(c.title)}</h2><p>${(c.bytes/1024/1024).toFixed(1)} MB · ${c.exists?'已保存':'文件缺失'}</p><div class="bili-actions">${button('offline:'+c.id,'离线播放')}${button('remove:'+c.id,'删除本地缓存')}</div></section>`).join(''):'<p class="bili-note">还没有缓存。打开本地样片，在播放器中选择“缓存”。</p>'}</div>`}
function libraryTools() {
  return button('import','添加视频链接')+button('cache-list','离线缓存')+
    button('web-import','导入 B 站网页记录')+button('web-history','已导入历史')+
    button('web-favorites','已导入收藏')+button('sample-shelf','交互样片')+
    (account==='connected'?button('cloud-history','账号观看历史')+button('cloud-folders','账号收藏')+button('disconnect','断开账号'):'');
}
function connect() {
  const viewed = Object.entries(state.history).filter(([,entry])=>entry?.position>0 || entry?.finished)
    .sort(([,a],[,b])=>b.at-a.at).map(([id])=>id);
  const history = [...new Set([...viewed,...discovery.webHistory().map(video=>video.id)])];
  const collections = [
    ['later','稍后观看',discovery.later(),'长按任意视频即可加入稍后观看。'],
    ['liked','已点赞',discovery.liked(),'在播放器中点赞的视频会出现在这里。'],
    ['history','观看历史',history,'还没有观看记录。']
  ];
  return collections.map(([key,title,ids,empty])=>{
    const items = ids.map(catalog).filter(Boolean);
    if(items.length) return videoShelf(title,items,'library:'+key+':');
    return `<section class="bili-glass-shelf"><h3>${title}</h3><p class="bili-feed-empty">${empty}</p></section>`;
  }).join('')+`<div class="bili-glass-chips">${button('library-tools','片库管理')}</div>`;
}
function webImport() {
  return `${header('导入网页记录')}<form id="bili-web-import-form" class="bili-import">
    <label>记录数据<textarea name="snapshot" rows="7" data-bili-id="web-snapshot" maxlength="100000" required></textarea></label>
    <button data-bili-id="submit" type="submit">保存到本机</button>
  </form><p class="bili-note" id="bili-web-import-note" role="status"></p>`;
}
function render(){
  const section=currentSection();
  const screen=({home,featured,search,detail:details,player,cache:cacheView,connect,shelf:shelfView,topics:topicsView,topic:topicView,import:importView,cloud:cloudView,webImport})[state.route]();
  const content=section?`${sectionBar(section)}<div class="bili-browse-scroll">${screen}</div>
    <footer class="bili-browse-hints"><span><kbd>↑↓←→</kbd> 移焦</span><span><kbd>●</kbd> 选择</span><span class="bili-more-hint"><kbd>长按</kbd> 更多</span><span><kbd>Esc</kbd> 返回</span>
    ${isFeed()?button('refresh-feed',feed.busy?'正在刷新…':'刷新热门',feed.busy?'aria-disabled="true"':''):''}</footer>`:screen;
  const mode=section?'bili-browsing':state.route==='topic'?'bili-topic-detail bili-browsing':state.route==='player'?'bili-watching'+(immersive?' bili-immersive':''):'';
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
function release(){clearOverlay();if(dashPlayer){const previous=dashPlayer;dashPlayer=null;previous.reset()}media?.pause?.();if(mediaURL)URL.revokeObjectURL(mediaURL);mediaURL='';media=null;mediaID=''}
function applySettings(){if(!media||media.tagName!=='VIDEO')return;media.playbackRate=state.rate;media.classList.toggle('bili-mirrored',state.mirror);for(const track of media.textTracks)track.mode='hidden';updateMedia()}
function updateMedia(){if(!active()||state.route!=='player'||state.busy||!media||media.tagName!=='VIDEO')return;const t=media.currentTime||0;const bar=document.querySelector('#bili-progress-bar');if(bar)bar.value=Number.isFinite(media.duration)&&media.duration>0?t/media.duration:0;const timer=document.querySelector('#bili-time');if(timer)timer.textContent=time(t)+' / '+time(media.duration||selected().duration||30);const play=document.querySelector('[data-bili-id="toggle"]');if(play&&play.dataset.paused!==String(media.paused)){play.dataset.paused=String(media.paused);play.innerHTML=icon(media.paused?'play':'pause');play.title=media.paused?'播放':'暂停'}updateOverlay();const caps=document.querySelector('#bili-captions');if(caps){const cues=['本地交互样片 · 非 B 站视频','镜像仅反转画面，字幕保持可读','方向键移焦 · 确认执行 · 返回退出','倍速、字幕与离线可在本地验证'];const caption=stream?stream.captionCues.find(c=>c.from<=t&&c.to>t)?.text:cues[t<7?0:t<15?1:t<23?2:3];caps.textContent=state.subtitle?(caption||''):'';caps.hidden=!caps.textContent}if(Date.now()-lastSave>1500){lastSave=Date.now();saveProgress(media,selected().id,state.part)}}
async function mountMedia(){const mount=document.querySelector('.bili-media-mount');if(!mount||state.busy)return;const v=selected();if(v.mode!=='demo'&&!stream)return;const id=v.id+':'+state.part+':'+state.offline+':'+(stream?.manifest||stream?.src||'');if(mediaID!==id){release();mediaID=id;media=document.createElement('video');media.playsInline=true;media.preload='metadata';media.setAttribute('aria-label',stream?'B 站视频画面':'本地交互样片画面');media.tabIndex=-1;const expected=id;if(state.offline){try{const item=await transaction('readonly',s=>s.get(v.id));if(mediaID!==expected)return;if(!item?.blob?.size)throw Error('缓存文件不存在，请重新保存');mediaURL=URL.createObjectURL(item.blob);media.src=mediaURL}catch(e){const el=document.querySelector('#bili-media-error');if(el){el.hidden=false;el.textContent=e.message}return}}else if(!stream?.manifest)media.src=stream?.src||DEMO;media.volume=(osData?.settings?.volume??60)/100;const video=media, partAtMount=state.part;media.onended=()=>saveProgress(video,v.id,partAtMount);media.onloadedmetadata=()=>{const recent=discovery.resume(v.id,state.history);const old=recent?.parts?.[partAtMount] || ((!recent?.part||recent.part===partAtMount)?recent:null);const position=old&&!old.finished?old.position:0;video.currentTime=Number.isFinite(position)&&position<video.duration-1?position:0;applySettings();if(autoStart){autoStart=false;video.play().catch(()=>{});}};media.ontimeupdate=updateMedia;media.onplay=updateMedia;
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
 media.onseeked=()=>{if(video.readyState>=3)clearBuffer();clearOverlay();updateMedia();};media.onpause=()=>{clearBuffer();updateMedia();saveProgress(video,v.id,partAtMount)};media.onerror=()=>{
  if(media!==video||!active()||state.route!=='player')return;
  if(stream?.manifest){if(!state.busy)void watchVideo(true, !media?.paused || autoStart);return}
  if(stream){release();stream=null;state.notice='暂时无法读取此视频，请重试播放。';draw('retry-play');return}
  const el=document.querySelector('#bili-media-error');
  if(el){el.hidden=false;el.textContent='样片无法播放，请重试或检查本地缓存。'}
 };}
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
  if(state.route==='topic')bindTopicScroll(body);
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
 if(state.route==='player'){
  mountMedia();
  const part = document.querySelector('.bili-episode-track [aria-pressed="true"]');
  if(part) {
   const track = part.parentElement;
   const item = part.getBoundingClientRect(), viewport = track.getBoundingClientRect();
   if(item.right>viewport.right-12)track.scrollLeft+=item.right-viewport.right+12;
  }
 }}};

function doSearch(q){state.query=String(q||'').trim().slice(0,80);if(!state.query){generation++;state.busy=false;state.items=[];state.error='';state.notice='';draw('query');return}state.route='search';if(state.mode==='live')loadSearch();else{state.items=discovery.search(state.query);state.error='';state.notice='来自本机片库';draw()}}
const click=osClick;osClick=async function(e){const b=e.target.closest('[data-bili-id]');if(!b||!active())return click(e);const id=b.dataset.biliId;if(b.matches('input,select,textarea,a')||id==='submit')return;
 if(id==='back')return back();if(id==='search'){if(state.route==='search'){focus('query');return}go('search',false);Object.assign(state,searchSession);draw('query');return}if(id==='connect'){
  if(state.route==='connect')return;
  go('connect');
  const gen=generation;
  try { account=(await request('account/status')).state; } catch { account='disconnected'; }
  if(active()&&gen===generation) draw();
  return;
 }
 if(id==='featured'){if(state.route!=='featured')go('featured');return;}
 if(id==='refresh-feed')return refreshFeed();
 if(id.startsWith('hot:')||id.startsWith('category:')){const item=cardVideo(id);if(item)return detail(item.id,true,item);return;}
 if(id.startsWith('related:'))return openRecommendation(id.slice(8));
 if(id==='recent'||id==='my-recent'){if(state.route!=='home'){go('home');return refreshFeed();}return;}
 if(id==='library-tools')return showPanel('library-tools');
 if(id.startsWith('library:')){const item=cardVideo(id);if(item)return detail(item.id,true,item);return;}
 if(id==='later')return shelf('稍后看',discovery.later().map(catalog));
 if(id==='topics'){if(state.route!=='topics')go('topics');return;}
 if(id.startsWith('topic:'))return openTopic(id.slice(6));
 if(id.startsWith('topic-video:')){const item=cardVideo(id);if(item)return detail(item.id,true,item);return;}
 if(id==='import')return go('import');
 if(id==='sample-shelf')return shelf('交互样片',samples);
 if(id==='menu-watch'){
  const video = menuVideo;
  state.panel = '';
  return detail(video.id,true,video,state.route==='player');
 }
 if(id==='save-like'||id==='menu-like'){
  const video = id==='save-like'?selected():menuVideo;
  try { discovery.toggleLike(video); }
  catch { state.notice='浏览器未能保存点赞。'; }
  if(id==='menu-like') draw(id);
  else {
   const liked = discovery.hasLike(video.id);
   const label = liked?'取消点赞':'点赞';
   b.setAttribute('aria-pressed',String(liked));
   b.setAttribute('aria-label',label);
   b.title = label;
  }
  return;
 }
 if(id==='menu-later'){
  try { discovery.toggleLater(menuVideo); }
  catch { state.notice='本机存储不可用，无法保存稍后看。'; }
  draw('menu-later');
  return;
 }
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
 if(id.startsWith('folder:'))return cloudShelf('favorites',id.slice(7));if(id==='cache-list'){await refreshCache();go('cache');return}if(id==='demo'){generation++;state.busy=false;state.mode='demo';state.items=[];state.error='';state.notice='';if(state.route==='search'&&state.query)doSearch(state.query);else draw();return}if(id==='live-search'){state.mode='live';if(state.query)return loadSearch();state.items=[];state.notice='';draw('query');return}if(id==='retry')return loadSearch();if(id.startsWith('term:'))return doSearch(id.slice(5));if(id.startsWith('video:'))return detail(id.slice(6),true);
 if(id==='danmaku-options')return showPanel('danmaku-options');
 if(id==='danmaku-switch'||id==='danmaku-curated'){
  if(id==='danmaku-switch')state.danmaku=!state.danmaku;
  else if(state.danmaku)state.curated=!state.curated;
  persist();
  clearOverlay();
  if (!state.panel) {
    const control = document.querySelector('[data-bili-id="danmaku-switch"]');
    control?.setAttribute('aria-pressed', String(state.danmaku));
    const key = selected().id + ':' + state.part;
    if (state.danmaku && commentTracks.get(key)?.error) commentTracks.delete(key);
    updateOverlay();
  } else draw(id);
  return;
 }
 if(id==='danmaku')return openDanmaku();

 if(id==='watch')return watchVideo();if(id==='parts')return showPanel('parts','part:'+state.part);if(id.startsWith('part:'))return changePart(+id.slice(5));
 if(id==='settings')return showPanel('settings');if(id==='cache-one')return showPanel('cache');if(id==='speed')return showPanel('speed');if(id==='close')return back();if(id==='download')return download();
 if(id==='mirror'){state.mirror=!state.mirror;persist();applySettings();draw('mirror');return}if(id==='subtitle'){state.subtitle=!state.subtitle;persist();applySettings();draw('subtitle');return}if(id.startsWith('rate:')){state.rate=+id.slice(5);persist();applySettings();state.panel='settings';draw('speed');return}
 if(id==='toggle'&&media?.tagName==='VIDEO'){try{if(media.paused)await media.play();else media.pause();updateMedia()}catch{state.notice='播放被浏览器阻止，请再次确认播放。';const el=document.querySelector('#bili-media-error');if(el){el.hidden=false;el.textContent=state.notice}}return}if(id==='rewind'||id==='forward'){skip(id);return}
 if(id==='fullscreen'){setImmersive(!immersive);return}

 if(id==='retry-play')return watchVideo(false,true);
 if(id.startsWith('offline:')){const item=samples.find(v=>v.id===id.slice(8));if(!item)return;state.selected=item;state.offline=true;state.part=1;go('player');return}if(id.startsWith('remove:')){await transaction('readwrite',s=>s.delete(id.slice(7)));await refreshCache();draw();return}
};
function changePart(part) {
  state.panel='';
  if(part===state.part){if(state.route!=='player')draw('parts');return;}
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
  const step=id==='rewind'?-10:10;
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

const cardTarget = target => target.closest?.('.bili-video-card,.bili-hero');
let cardHold;
function stopCardHold() {
  if (!cardHold) return;
  clearTimeout(cardHold.timer);
  cardHold.target.classList.remove('bili-card-holding');
  cardHold = null;
}
function startCardHold(event, target) {
  stopCardHold();
  target.classList.add('bili-card-holding');
  const hold = {target,x:event.clientX,y:event.clientY};
  hold.timer = setTimeout(()=>{
    stopCardHold();
    if (target.isConnected && !state.panel) openCardMenu(target);
  },550);
  cardHold = hold;
}
document.addEventListener('pointerdown', event => {
  const target = cardTarget(event.target);
  if (target && event.button === 0) startCardHold(event,target);
});
document.addEventListener('pointermove', event => {
  if (cardHold && Math.hypot(event.clientX-cardHold.x,event.clientY-cardHold.y)>12) stopCardHold();
});
for (const type of ['pointerup','pointercancel','blur']) window.addEventListener(type,stopCardHold,true);
document.addEventListener('contextmenu', event => {
  const target = cardTarget(event.target);
  if (target && !state.panel && openCardMenu(target)) event.preventDefault();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.repeat && state.panel === 'card-menu') { event.preventDefault(); return; }
  const target = cardTarget(event.target);
  if (!target || state.panel) return;
  if (event.key.toLowerCase() === 'm' && openCardMenu(target)) event.preventDefault();
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (!event.repeat) startCardHold(event,target);
});
document.addEventListener('keyup', event => {
  if (event.key !== 'Enter' || !cardHold || cardHold.x !== undefined) return;
  const target = cardHold.target;
  stopCardHold();
  if (target.isConnected && !state.panel) target.click();
});
window.BilibiliService={scope,back,open(){state.panel='';osNavigate('bilibili');if(isFeed())void refreshFeed();requestAnimationFrame(()=>{if(active())window.LegoGamepad?.refreshFocus(true)})},snapshot(){return {route:state.route,mode:state.mode,panel:state.panel,mirror:state.mirror,rate:state.rate,subtitle:state.subtitle,offline:state.offline}}};
window.LegoHandoffs?.entries.push({id:'bilibili',name:'Bilibili',glyph:'play'});
const nav=osNavigate;osNavigate=function(page){if(active()&&page!=='bilibili'){stopPoll();remember();media?.pause?.()}return nav(page)};
document.addEventListener('keydown',event=>{
  if (state.route!=='search' || event.target.dataset?.biliId!=='query' || !['ArrowUp','ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  focus(event.key==='ArrowUp'?'search':'term:动画');
});
document.addEventListener('DOMContentLoaded',()=>{if(!osData)bootOS()},{once:true});
if(new URLSearchParams(location.search).get('service')==='bilibili'){const auto=setInterval(()=>{if(osData){clearInterval(auto);window.BilibiliService.open()}},100)}
})();
