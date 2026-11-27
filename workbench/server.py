"""Run the standalone GlassTube Bilibili workbench on loopback."""
import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import bilibili_connector as connector

PUBLIC = Path(__file__).resolve().parent / 'public'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def send(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        host = self.headers.get('Host', '')
        port = self.server.server_port
        if host not in (f'127.0.0.1:{port}', f'localhost:{port}'):
            return self.send({'error': '只允许本地访问'}, 403)
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + host:
            return self.send({'error': '不允许跨站请求'}, 403)
        url = urlsplit(self.path)
        if not url.path.startswith('/api/bilibili/'):
            return super().do_GET()
        query = parse_qs(url.query)
        try:
            if url.path == '/api/bilibili/manifest':
                return connector.serve_manifest(self, query)
            if url.path == '/api/bilibili/media':
                return connector.serve_media(self, query)
            if url.path.startswith('/api/bilibili/account/'):
                if url.path == '/api/bilibili/account/status':
                    return self.send({'state': 'disconnected'})
                return self.send({'error': '账号授权未启用'}, 403)
            return self.send(connector.route(url.path, query))
        except connector.BiliUnavailable as error:
            return self.send({'error': str(error)}, 502)
        except ValueError as error:
            return self.send({'error': str(error)}, 400)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8975)
    port = parser.parse_args().port
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'GlassTube B 站设备版 · http://127.0.0.1:{server.server_port}', flush=True)
    server.serve_forever()
