/* The discovery shelf belongs to this browser and works without a Bilibili account. */
(function (root) {
  'use strict';
  const key = 'lego-bilibili-discovery-v1';
  const snapshotKey = 'lego-bilibili-web-snapshot-v1';
  const topics = ['知识与科技', '生活记录', '动画与游戏', '运动与跟练', '未分类'];
  const videoId = /^BV[A-Za-z0-9]{10}$/;

  function parseVideo(input) {
    const value = String(input || '').trim();
    if (videoId.test(value)) return value;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password ||
          !['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.host)) return null;
      const id = url.pathname.match(/^\/video\/(BV[A-Za-z0-9]{10})\/?$/)?.[1];
      return id || null;
    } catch { return null; }
  }

  function coverUrl(value) {
    try {
      const url = new URL(String(value || '').replace(/^\/\//,'https://'));
      return ['http:','https:'].includes(url.protocol) && /^i[0-9]+\.hdslb\.com$/.test(url.host) &&
        !url.username && !url.password ? url.href.replace(/^http:/,'https:') : '';
    } catch { return ''; }
  }

  function cleanSnapshot(payload) {
    function entries(rows, history) {
      if (!Array.isArray(rows)) return [];
      const unique = new Map();
      for (const row of rows.slice(0, 100)) {
        const id = parseVideo(row?.id || row?.url);
        const title = typeof row?.title === 'string' ? row.title.trim().slice(0, 160) : '';
        if (!id || !title || unique.has(id)) continue;
        const number = n => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
        const duration = number(row.duration);
        const item = {
          id, title, duration, cover: coverUrl(row.cover || row.pic), author: typeof row.author === 'string' ? row.author.slice(0, 80) : '',
          mode: 'official', url: 'https://www.bilibili.com/video/' + id, topic: '未分类',
          reason: history ? 'B 站网页历史 · 已导入' : 'B 站网页收藏 · 已导入'
        };
        const part = row.part ?? row.resume?.part;
        if (history) item.resume = {
          position: Math.min(number(row.position ?? row.resume?.position), duration || 86400),
          part: Number.isInteger(part) && part > 0 && part <= 9999 ? part : 1,
          finished: (row.finished ?? row.resume?.finished) === true
        };
        unique.set(id, item);
      }
      return [...unique.values()];
    }
    return {history: entries(payload?.history, true), favorites: entries(payload?.favorites, false)};
  }

  function create(storage, featured) {
    let data;
    try { data = JSON.parse(storage.getItem(key) || '{}'); } catch { data = {}; }
    const added = new Map((Array.isArray(data?.added) ? data.added : [])
      .filter(item => videoId.test(item?.id)).map(item => [item.id, item]));
    const later = new Set(Array.isArray(data?.later) ? data.later : []);
    const liked = new Set(Array.isArray(data?.liked) ? data.liked : []);
    let snapshot;
    try { snapshot = cleanSnapshot(JSON.parse(storage.getItem(snapshotKey) || '{}')); }
    catch { snapshot = {history: [], favorites: []}; }
    const imported = () => [...snapshot.favorites, ...snapshot.history];
    const catalog = () => [...new Map([...imported(), ...featured, ...added.values()].map(item => [item.id, {...item,cover:coverUrl(item.cover)||featured.find(seed=>seed.id===item.id)?.cover||''}])).values()];
    function save() {
      storage.setItem(key, JSON.stringify({added: [...added.values()], later: [...later], liked: [...liked]}));
    }
    function remember(video, fields = {}) {
      const id = video?.id;
      if (!videoId.test(id)) return;
      const seed = featured.find(item => item.id === id);
      const previous = added.get(id) || seed;
      added.set(id, {
        id,
        title: fields.title || (video.title && video.title !== id ? video.title : previous?.title) || id,
        author: video.author || previous?.author || '',
        cover: coverUrl(video.cover) || coverUrl(previous?.cover) || seed?.cover || '',
        description: video.description || previous?.description || '',
        duration: Number(video.duration) || previous?.duration || 0,
        parts: video.parts?.length ? video.parts : previous?.parts || [],
        topic: fields.topic || previous?.topic || '未分类',
        reason: fields.reason || previous?.reason || '加入本机片库',
        mode: 'official',
        url: 'https://www.bilibili.com/video/' + id
      });
      save();
    }
    return {
      add(input, fields) {
        const id = parseVideo(input);
        if (!id) throw Error('请输入完整 B 站视频链接或 BV 号。');
        remember({id}, fields);
        return id;
      },
      remember,
      importSnapshot(payload) {
        const next = cleanSnapshot(payload);
        if (!next.history.length && !next.favorites.length) throw Error('没有可导入的 B 站视频。');
        storage.setItem(snapshotKey, JSON.stringify(next));
        snapshot = next;
        return {history: next.history.length, favorites: next.favorites.length};
      },
      webHistory: () => snapshot.history,
      webFavorites: () => snapshot.favorites,
      resume(id, history) {
        if (Object.hasOwn(history, id)) return history[id];
        return snapshot.history.find(item => item.id === id)?.resume;
      },
      find: id => catalog().find(item => item.id === id),
      featured: () => featured.map(item => {
        const saved=added.get(item.id);
        return saved ? {...item,...saved,cover:coverUrl(saved.cover)||item.cover} : item;
      }),
      byTopic: topic => catalog().filter(item => item.topic === topic),
      search(q) {
        const query = q.normalize('NFKC').toLowerCase();
        return catalog().filter(item => [item.title, item.author, item.topic, item.id]
          .some(field => String(field || '').normalize('NFKC').toLowerCase().includes(query)));
      },
      hasLike: id => liked.has(id),
      toggleLike(video) {
        if (liked.has(video.id)) liked.delete(video.id);
        else { remember(video); liked.add(video.id); }
        save();
      },
      liked: () => [...liked].reverse(),
      hasLater: id => later.has(id),
      toggleLater(video) {
        if (later.has(video.id)) later.delete(video.id);
        else { remember(video); later.add(video.id); }
        save();
      },
      later: () => [...later].reverse(),
      recent(history) {
        return Object.entries(history)
          .filter(([, value]) => value?.position > 1 && !value.finished)
          .sort(([, a], [, b]) => b.at - a.at)
          .map(([id]) => id)
          .concat(snapshot.history.filter(item => item.resume.position > 1 && !item.resume.finished &&
            !Object.hasOwn(history, item.id)).map(item => item.id));
      }
    };
  }
  root.BilibiliDiscovery = {create, topics, coverUrl};
})(globalThis);
