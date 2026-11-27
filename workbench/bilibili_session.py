"""Short-lived browser sessions for Bilibili's web QR login."""
import base64
import io
import json
import re
import secrets
import sys
import threading
import time
from http.cookies import SimpleCookie, CookieError
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

COOKIE_NAME = 'lego_bili_session'
_SESSION_TTL = 8 * 3600
_QR_TTL = 180
_WEB_SOURCE = "main_web"
_sessions = {}
_lock = threading.Lock()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_opener = build_opener(NoRedirect())


def upstream(host, path, params=None, credentials=None):
    headers = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/', 'Accept': 'application/json'}
    if host == 'passport.bilibili.com':
        headers['Referer'] = 'https://passport.bilibili.com/login'
    if credentials:
        headers['Cookie'] = '; '.join(f'{k}={v}' for k, v in credentials.items())
    request = Request('https://' + host + '/' + path + '?' + urlencode(params or {}), headers=headers)
    with _opener.open(request, timeout=7) as response:
        cookies = SimpleCookie()
        for value in response.headers.get_all('Set-Cookie', []):
            cookies.load(value)
        return json.loads(response.read(3_000_000)), {
            name: cookies[name].value for name in ('SESSDATA', 'DedeUserID') if name in cookies
        }


def get_session(header):
    jar = SimpleCookie()
    try:
        jar.load(header or '')
    except CookieError:
        return None, None
    token = jar[COOKIE_NAME].value if COOKIE_NAME in jar else None
    with _lock:
        now = time.monotonic()
        for old in [k for k, v in _sessions.items() if v['until'] <= now]:
            del _sessions[old]
        return token, _sessions.get(token)


def qr_image(url):
    try:
        import qrcode
    except ImportError:
        sys.path.insert(0, str(Path(__file__).parent / 'data' / 'bilibili-runtime'))
        import qrcode
    from qrcode.image.svg import SvgPathFillImage
    buffer = io.BytesIO()
    qrcode.make(url, image_factory=SvgPathFillImage).save(buffer)
    return 'data:image/svg+xml;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')


def start():
    data, _ = upstream('passport.bilibili.com', 'x/passport-login/web/qrcode/generate',
                       {'source': _WEB_SOURCE})
    if data.get('code') != 0:
        raise ValueError('B 站暂时无法创建扫码会话。')
    qr = data['data']
    url = urlsplit(qr['url'])
    if url.scheme != 'https' or url.hostname not in {'account.bilibili.com', 'passport.bilibili.com', 'www.bilibili.com'}:
        raise ValueError('B 站返回了无法识别的扫码地址。')
    image = qr_image(qr['url'])
    token = secrets.token_urlsafe(32)
    with _lock:
        if len(_sessions) >= 100:
            raise ValueError('扫码会话已满，请稍后再试。')
        _sessions[token] = {'key': qr['qrcode_key'], 'until': time.monotonic() + _QR_TTL, 'next_poll': 0}
    return token, {'qr': image}


def poll(session):
    if not session:
        return {'state': 'expired'}
    with _lock:
        if session.get('credentials'):
            return {'state': 'connected'}
        if time.monotonic() < session['next_poll']:
            return {'state': 'waiting'}
        session['next_poll'] = time.monotonic() + 2
    data, credentials = upstream('passport.bilibili.com', 'x/passport-login/web/qrcode/poll',
                                 {'qrcode_key': session['key'], 'source': _WEB_SOURCE})
    outer_code = data.get('code')
    code = (data.get('data') or {}).get('code') if outer_code == 0 else outer_code
    if code == 0 and credentials.get('SESSDATA'):
        with _lock:
            session.update(credentials=credentials, until=time.monotonic() + _SESSION_TTL)
        return {'state': 'connected'}
    known = {86101: 'waiting', 86090: 'scanned', 86038: 'expired'}
    if code in known:
        return {'state': known[code]}
    return {'state': 'rejected', 'code': code if type(code) is int else None}


def disconnect(token):
    with _lock:
        _sessions.pop(token, None)


def personal(kind, folder, session):
    credentials = (session or {}).get('credentials')
    if not credentials:
        raise ValueError('请先扫码连接 B 站账号。')
    uid = credentials.get('DedeUserID', '')
    if kind == 'history':
        resource, params = 'x/web-interface/history/cursor', {'ps': 12}
    elif kind == 'folders' and uid.isdecimal():
        resource, params = 'x/v3/fav/folder/created/list-all', {'up_mid': uid}
    elif kind == 'favorites' and re.fullmatch(r'\d{1,20}', folder or ''):
        resource, params = 'x/v3/fav/resource/list', {'media_id': folder, 'pn': 1, 'ps': 12}
    else:
        raise ValueError('无法读取收藏夹。')
    result, _ = upstream('api.bilibili.com', resource, params, credentials)
    if result.get('code') != 0:
        raise ValueError('B 站未返回账号数据，请检查登录状态后重试。')
    return result.get('data') or {}
