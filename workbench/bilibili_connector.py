"""Read-only Bilibili adapter for public videos and explicitly connected accounts."""
import html,json,re,time,threading,urllib.request,urllib.parse,urllib.error
import base64, hmac, os, secrets, shutil, zlib
from concurrent.futures import ThreadPoolExecutor
import xml.etree.ElementTree as ET
import bilibili_session
_CACHE={};_LOCK=threading.Lock()
class BiliUnavailable(Exception):pass
def _request(resource,params):
 fresh = resource == 'x/web-interface/popular'
 key=(resource,urllib.parse.urlencode(params))
 with _LOCK:
  hit=_CACHE.get(key)
  if not fresh and hit and time.monotonic()-hit[0]<120:return hit[1]
 req=urllib.request.Request('https://api.bilibili.com/'+resource+'?'+key[1],headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/','Accept':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=6) as response:d=json.loads(response.read(3_000_000))
 except Exception as exc:raise BiliUnavailable('游客接口暂不可用，请稍后重试。') from exc
 if d.get('code')!=0:raise BiliUnavailable('B站游客接口限制了本次读取（代码 '+str(d.get('code'))+'），未尝试绕过验证。')
 if not fresh:
  with _LOCK:_CACHE[key]=(time.monotonic(),d['data'])
 return d['data']
def cover_url(value):
 if not isinstance(value, str):
  return ''
 url = urllib.parse.urlsplit('https:'+value if value.startswith('//') else value)
 if url.scheme in ('http','https') and re.fullmatch(r'i[0-9]+\.hdslb\.com',url.netloc):
  return url._replace(scheme='https',fragment='').geturl()
 return ''

def normalize(v):
 bvid=v.get('bvid','')
 if not re.fullmatch(r'BV[A-Za-z0-9]{10}',bvid):return None
 owner=v.get('owner') or {}
 return {'id':bvid,'cover':cover_url(v.get('pic')),'title':html.unescape(re.sub('<[^>]*>','',v.get('title',''))),'author':owner.get('name') or v.get('author',''),'description':v.get('desc') or v.get('description',''),'duration':v.get('duration',0),'topic':v.get('tname',''),'mode':'official','url':'https://www.bilibili.com/video/'+bvid,'parts':[{'page':p.get('page',1),'title':p.get('part',''),'cid':p.get('cid'),'cover':cover_url(p.get('first_frame'))} for p in v.get('pages',[])],'rights':{'mirror':False,'rate':False,'subtitle':False,'offline':False},'source':'Bilibili 游客接口（非开放平台稳定契约）','cid':v.get('cid')}
CATEGORY_START = 5
CATEGORY_LAST = 12


def popular_page(page):
 return _request('x/web-interface/popular', {'pn':page,'ps':50})


def popular_items(pages, topic=None):
 items = {}
 for page in pages:
  for raw in page.get('list', []):
   video = normalize(raw)
   if video and (topic is None or (video['topic'] or '其他') == topic):
    items.setdefault(video['id'], video)
 return list(items.values())


def home_feed():
 first = popular_page(1)
 with ThreadPoolExecutor(max_workers=3) as pool:
  jobs = [pool.submit(popular_page, page) for page in range(2, CATEGORY_START)]
  pages = [first]
  next_page = 2
  for job in jobs:
   try:
    pages.append(job.result())
    next_page += 1
   except BiliUnavailable:
    break
 return {'items':popular_items([first]), 'categoryItems':popular_items(pages), 'categoryPage':next_page}


def category_feed(query):
 topic = query.get('topic', [''])[0].strip()
 page_text = query.get('page', [''])[0]
 if not topic or len(topic)>80 or not re.fullmatch(r'[1-9][0-9]?',page_text):
  raise ValueError('无效分类或页码')
 page = int(page_text)
 if page > CATEGORY_LAST:
  raise ValueError('无效页码')
 end = min(page+2, CATEGORY_LAST+1)
 with ThreadPoolExecutor(max_workers=2) as pool:
  pages = list(pool.map(popular_page,range(page,end)))
 return {'items':popular_items(pages,topic), 'nextPage':None if end>CATEGORY_LAST or pages[-1].get('no_more') else end}


def route(path,query):
 if path=='/api/bilibili/capabilities':return {'provider':'guest-readonly','accountConnected':False,'discovery':True,'search':True,'detail':True,'playback':'public-dash-mp4-with-embed-fallback','nativeControls':False,'offline':False,'reason':'官方嵌入的跨域媒体控制未获可用协议；本地样片可验证焦点、镜像、倍速、字幕和离线。'}
 if path=='/api/bilibili/play':return playback(query)
 if path=='/api/bilibili/danmaku':return danmaku(query)
 if path=='/api/bilibili/parts':
  ident=video_id(query)
  return {'parts':[{'page':p.get('page'), 'cid':p.get('cid'), 'title':p.get('part', ''), 'cover':cover_url(p.get('first_frame'))} for p in _request('x/player/pagelist',{'bvid':ident})]}
 if path=='/api/bilibili/home':return home_feed()
 if path=='/api/bilibili/category':return category_feed(query)
 if path=='/api/bilibili/related':
  ident=video_id(query)
  vs=[v for v in _request('x/web-interface/archive/related',{'bvid':ident}) if v.get('bvid')!=ident][:20]
 elif path=='/api/bilibili/search':
  q=query.get('q',[''])[0].strip()[:80]
  if not q:raise ValueError('请输入关键词')
  d=_request('x/web-interface/search/type',{'search_type':'video','keyword':q,'page':1});vs=d.get('result',[])[:12]
 elif path=='/api/bilibili/video':
  ident=query.get('id',[''])[0]
  if not re.fullmatch(r'BV[A-Za-z0-9]{10}',ident):raise ValueError('无效 BV 号')
  return {'item':normalize(_request('x/web-interface/view',{'bvid':ident})),'mode':'live'}
 else:raise ValueError('未知 Bilibili 接口')
 return {'items':[n for n in map(normalize,vs) if n],'mode':'live','personalized':False,'source':'Bilibili 公开内容 · 游客读取'}

# Only video URLs returned by Bilibili for the requested public video are eligible.
_media = {}
_media_lock = threading.Lock()
_SIGNING_KEY = os.environ.get('GLASSTUBE_PLAYBACK_SECRET', '').encode()


def _playback_token(namespace, payload):
 encoded = base64.urlsafe_b64encode(zlib.compress(payload)).decode().rstrip('=')
 body = f'{int(time.time())+1800}.{encoded}'
 signature = hmac.digest(_SIGNING_KEY, (namespace+':'+body).encode(), 'sha256').hex()
 return body+'.'+signature


def _playback_payload(namespace, token):
 if not _SIGNING_KEY or len(token)>16384:
  return None
 try:
  body, signature = token.rsplit('.',1)
  expected = hmac.digest(_SIGNING_KEY,(namespace+':'+body).encode(),'sha256').hex()
  if not hmac.compare_digest(signature, expected):
   return None
  expires, encoded = body.split('.',1)
  if int(expires)<=time.time():
   return None
  return zlib.decompress(base64.urlsafe_b64decode(encoded+'='*(-len(encoded)%4)))
 except (ValueError, zlib.error):
  return None



def video_id(query):
 ident = query.get('id', [''])[0]
 if not re.fullmatch(r'BV[A-Za-z0-9]{10}', ident):
  raise ValueError('无效 BV 号')
 return ident


def approved_url(url, subtitle=False):
 try:
  parsed = urllib.parse.urlsplit(url)
  host = parsed.hostname or ''
  allowed = (host == 'aisubtitle.hdslb.com' if subtitle else
             host == 'upos-hz-mirrorakam.akamaized.net' or host.endswith(('.bilivideo.com', '.bilivideo.cn')))
  return parsed.scheme == 'https' and parsed.port in (None, 443) and not parsed.username and allowed
 except (TypeError, ValueError):
  return False


def media_url(url):
 if not approved_url(url):
  raise BiliUnavailable('此视频的媒体地址暂不受支持。')
 if _SIGNING_KEY:
  return '/api/bilibili/media?token='+_playback_token('media',url.encode())
 token = secrets.token_urlsafe(24)
 with _media_lock:
  now = time.monotonic()
  for old in [key for key, (expiry, _) in _media.items() if expiry < now]:
   del _media[old]
  if len(_media) >= 100:
   _media.pop(next(iter(_media)))
  _media[token] = (now + 1800, url)
 return '/api/bilibili/media?token=' + token


_mpd = {}


def dash_manifest(info):
 from xml.etree.ElementTree import Element, SubElement, tostring
 dash = info.get('dash') or {}
 duration = float(dash.get('duration') or 0)
 if not 0 < duration < 86400 or info.get('is_preview') or info.get('is_drm'):
  return None
 mpd = Element('MPD', xmlns='urn:mpeg:dash:schema:mpd:2011', type='static',
               profiles='urn:mpeg:dash:profile:isoff-on-demand:2011',
               mediaPresentationDuration=f'PT{duration}S', minBufferTime='PT2S')
 period = SubElement(mpd, 'Period', start='PT0S')
 for kind, codec in [('video','avc1.'), ('audio','mp4a.')]:
  for track in dash.get(kind) or []:
   url = track.get('baseUrl') or track.get('base_url')
   if not isinstance(url,str) or not approved_url(url) or not str(track.get('codecs','')).startswith(codec):
    continue
   segment = track.get('SegmentBase') or {}
   init, index = segment.get('Initialization',''), segment.get('indexRange','')
   if not all(re.fullmatch(r'[0-9]+-[0-9]+', x) for x in (init,index)):
    continue
   adaptation = SubElement(period,'AdaptationSet', contentType=kind, mimeType=kind+'/mp4')
   rep = SubElement(adaptation,'Representation', id=kind, codecs=track['codecs'],
                    bandwidth=str(int(track.get('bandwidth') or 128000)))
   SubElement(rep,'BaseURL').text = media_url(url)
   base = SubElement(rep,'SegmentBase',indexRange=index)
   SubElement(base,'Initialization',range=init)
   break
  else:
   return None
 payload = tostring(mpd, encoding='utf-8')
 if _SIGNING_KEY:
  return '/api/bilibili/manifest?token='+_playback_token('manifest',payload)
 token = secrets.token_urlsafe(24)
 with _media_lock:
  now = time.monotonic()
  for key in [key for key,(expires,_) in _mpd.items() if expires < now]:
   del _mpd[key]
  if len(_mpd) >= 50:
   _mpd.pop(next(iter(_mpd)))
  _mpd[token] = (now + 1800, payload)
 return '/api/bilibili/manifest?token=' + token


def manifest_payload(token):
 if _SIGNING_KEY:
  return _playback_payload('manifest', token)
 with _media_lock:
  entry = _mpd.get(token)
 return entry[1] if entry and entry[0]>=time.monotonic() else None


def serve_manifest(handler, query):
 payload = manifest_payload(query.get('token',[''])[0])
 if not payload:
  return handler.send({'error':'播放地址已过期。'}, 404)
 handler.send_response(200)
 handler.send_header('Content-Type','application/dash+xml')
 handler.send_header('Content-Length', str(len(payload)))
 handler.end_headers()
 handler.wfile.write(payload)


def part_params(query):
 ident = video_id(query)
 page = query.get('page', ['1'])[0]
 if not re.fullmatch(r'[1-9][0-9]{0,3}', page):
  raise ValueError('无效分集')
 parts = _request('x/player/pagelist', {'bvid': ident})
 part = next((p for p in parts if str(p.get('page')) == page), None)
 if not part or not isinstance(part.get('cid'), int):
  raise BiliUnavailable('此分集暂时无法读取。')
 return {'bvid': ident, 'cid': part['cid']}

def danmaku(query):
 params = part_params(query)
 try:
  at = float(query.get('at', ['0'])[0])
 except (TypeError, ValueError):
  raise ValueError('无效播放时间') from None
 if not 0 <= at <= 1_000_000:
  raise ValueError('无效播放时间')
 cid = params['cid']
 req = urllib.request.Request(f'https://comment.bilibili.com/{cid}.xml',
   headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'})
 try:
  limit = 2_000_000
  with urllib.request.urlopen(req, timeout=5) as response:
   payload = response.read(limit+1)
   encoding = response.headers.get('Content-Encoding','identity').lower()
  if len(payload)>limit:
   raise ValueError('弹幕文档过大')
  if encoding == 'deflate':
   try:
    payload = zlib.decompressobj().decompress(payload,limit+1)
   except zlib.error:
    payload = zlib.decompressobj(-zlib.MAX_WBITS).decompress(payload,limit+1)
  elif encoding == 'gzip':
   payload = zlib.decompressobj(16+zlib.MAX_WBITS).decompress(payload,limit+1)
  elif encoding != 'identity':
   raise ValueError('未知弹幕压缩格式')
  if len(payload)>limit or b'<!' in payload:
   raise ValueError('无效弹幕文档')
  root = ET.fromstring(payload)
  if root.tag != 'i':
   raise ValueError('无效弹幕文档')
 except (OSError, ET.ParseError, ValueError, zlib.error) as exc:
  raise BiliUnavailable('此分集的公开弹幕暂时无法读取。') from exc
 items = []
 full = query.get('all') == ['1']
 for entry in root.findall('d'):
  try:
   timestamp, mode, size, color, *_ = entry.get('p', '').split(',')
   timestamp, mode, size, color = float(timestamp), int(mode), int(size), int(color)
  except ValueError:
   continue
  content = (entry.text or '').strip()
  if content and 0 <= timestamp <= 1_000_000 and (full or abs(timestamp-at)<=30):
   if full and mode not in (1, 2, 3, 4, 5, 6):
    continue
   items.append({'at':timestamp, 'text':content[:160], 'mode':mode,
                 'size':max(12, min(36, size)), 'color':color & 0xffffff})
 if not full:
  items = sorted(items, key=lambda item:abs(item['at']-at))[:12]
 return {'items':sorted(items,key=lambda item:item['at'])[:10000]}


def playback(query):
 params = part_params(query)
 manifest = None
 if query.get('format') != ['mp4']:
  try:
   manifest = dash_manifest(_request('x/player/playurl', {**params, 'qn': 16, 'fnval': 16}))
  except (BiliUnavailable, ValueError, TypeError):
   pass
 if manifest:
  source = {'manifest':manifest}
 else:
  info = _request('x/player/playurl', {**params, 'qn': 16, 'fnval': 1, 'platform': 'html5'})
  videos = info.get('durl') or []
  if len(videos) != 1 or 'mp4' not in str(info.get('format', '')).lower():
   raise BiliUnavailable('此稿件暂未提供可直接播放的公开媒体。')
  source = {'src':media_url(videos[0].get('url','')), 'quality':info.get('quality')}
 captions = []
 try:
  meta = _request('x/player/v2', params)
  subtitles = (meta.get('subtitle') or {}).get('subtitles', [])
  for item in subtitles:
   subtitle = item.get('subtitle_url', '')
   if subtitle.startswith('//'):
    subtitle = 'https:' + subtitle
   if not approved_url(subtitle, True):
    continue
   with bilibili_session._opener.open(urllib.request.Request(
      subtitle, headers={'Referer': 'https://www.bilibili.com/'}), timeout=4) as response:
    body = json.loads(response.read(1_500_000)).get('body', [])
   captions = [{'from': c['from'], 'to': c['to'], 'text': str(c['content'])[:500]} for c in body[:3000]]
   if captions:
    break
 except (BiliUnavailable, ValueError, OSError, KeyError, TypeError):
  pass
 return {**source, 'captionCues': captions, 'offline': False}


def open_media(token, byte_range):
 if _SIGNING_KEY:
  payload = _playback_payload('media', token)
  url = payload.decode() if payload else ''
 else:
  with _media_lock:
   entry = _media.get(token)
  url = entry[1] if entry and entry[0]>=time.monotonic() else ''
 if not approved_url(url):
  return None, '播放地址已过期，请重新打开视频。', 404
 headers = {'Referer':'https://www.bilibili.com/', 'User-Agent':'Mozilla/5.0'}
 if byte_range:
  if not re.fullmatch(r'bytes=(?:\d{1,12}-\d{0,12}|-\d{1,12})', byte_range):
   return None, '无效的播放范围。', 416
  headers['Range'] = byte_range
 try:
  response = bilibili_session._opener.open(urllib.request.Request(url, headers=headers), timeout=12)
 except OSError:
  return None, '媒体暂时不可用。', 502
 if response.status not in (200,206) or response.headers.get_content_type() not in ('video/mp4','audio/mp4','application/octet-stream'):
  response.close()
  return None, '此媒体格式暂不支持。', 502
 return response, None, response.status


def serve_media(handler, query):
 response, error, status = open_media(query.get('token',[''])[0], handler.headers.get('Range'))
 if error:
  return handler.send({'error':error},status)
 with response:
  handler.send_response(response.status)
  handler.send_header('Content-Type', response.headers.get_content_type())
  handler.send_header('X-Content-Type-Options', 'nosniff')
  for key in ('Content-Length', 'Content-Range', 'Accept-Ranges'):
   if response.headers.get(key):
    handler.send_header(key, response.headers[key])
  handler.end_headers()
  try:
   shutil.copyfileobj(response, handler.wfile, 128 * 1024)
  except (OSError, ConnectionError):
   pass


def account_route(path, query, cookie):
 _, session = bilibili_session.get_session(cookie)
 kind = path.rsplit('/', 1)[-1]
 if kind == 'status':
  return {'state': 'connected' if (session or {}).get('credentials') else 'disconnected'}
 if kind == 'poll':
  return bilibili_session.poll(session)
 if kind not in ('history', 'folders', 'favorites'):
  raise ValueError('未知账号接口')
 data = bilibili_session.personal(kind, query.get('folder', [''])[0], session)
 if kind == 'folders':
  return {'folders': [{'id': str(v['id']), 'title': str(v['title'])} for v in (data.get('list') or [])[:20]]}
 items = []
 for row in data.get('list' if kind == 'history' else 'medias') or []:
  source = dict(row)
  if kind == 'history':
   source['bvid'] = (row.get('history') or {}).get('bvid', '')
  item = normalize(source)
  if item:
   items.append(item)
 return {'items': items}
