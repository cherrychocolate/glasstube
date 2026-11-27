"""Vercel Flask entry point for the GlassTube device player."""
import os
from pathlib import Path
import sys

from flask import Flask, Response, jsonify, request, send_from_directory

WORKBENCH = Path(__file__).resolve().parent / 'workbench'
sys.path.insert(0, str(WORKBENCH))
import bilibili_connector as connector

app = Flask(__name__, static_folder=None)
PUBLIC = WORKBENCH / 'public'


@app.get('/api/bilibili/<path:endpoint>')
def bilibili(endpoint):
    origin = request.headers.get('Origin')
    if origin and origin not in {request.host_url.rstrip('/'), f'https://{request.host}'}:
        return jsonify(error='不允许跨站请求'), 403
    if endpoint == 'account/status':
        return jsonify(state='disconnected')
    if endpoint.startswith('account/'):
        return jsonify(error='账号授权未启用'), 403

    token = request.args.get('token', '')
    if endpoint in {'play', 'manifest', 'media'} and not os.environ.get('GLASSTUBE_PLAYBACK_SECRET'):
        return jsonify(error='尚未配置在线播放器。'), 503
    if endpoint == 'manifest':
        payload = connector.manifest_payload(token)
        if not payload:
            return jsonify(error='播放地址已过期。'), 404
        return Response(payload, mimetype='application/dash+xml', headers={'Cache-Control': 'no-store'})
    if endpoint == 'media':
        upstream, error, status = connector.open_media(token, request.headers.get('Range'))
        if error:
            return jsonify(error=error), status
        headers = {'Content-Type': upstream.headers.get_content_type(),
                   'Cache-Control': 'private, no-store',
                   'X-Content-Type-Options': 'nosniff'}
        for name in ('Content-Length', 'Content-Range', 'Accept-Ranges'):
            if name in upstream.headers:
                headers[name] = upstream.headers[name]
        response = Response(iter(lambda: upstream.read(128 * 1024), b''), status=status, headers=headers)
        response.call_on_close(upstream.close)
        return response

    try:
        result = connector.route('/api/bilibili/' + endpoint, request.args.to_dict(flat=False))
    except connector.BiliUnavailable as error:
        return jsonify(error.response()), error.status
    except ValueError as error:
        return jsonify(error=str(error)), 400
    response = jsonify(result)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.get('/')
@app.get('/<path:asset>')
def static_asset(asset='index.html'):
    return send_from_directory(PUBLIC, asset)
