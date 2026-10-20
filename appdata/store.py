"""Server-side copy of the YouTube app's own browser data (playlists, search groups, hidden feed
videos, channel feed order, hover-preview setting). The pages keep using browser storage, and the
script at the top of handlers.js (app-data.js) mirrors every change here, so clearing the browser
or switching browsers no longer loses them. Same design as Pinless (appdata.go).

  GET  /items  -> {"items": {"key": "value" or null}}   (null = deleted on purpose)
  POST /items  <- {"items": {...}, "backup": {...}}      (merge; this app's pages only)

Reached through the gateway as /app-data/items. Files live in /data (the appdata volume):
  store.json                    the current data
  daily/store-YYYY-MM-DD.json   one copy per day, the last 14 days
  first-sync/<time>.json        a browser's own copy whenever it differed from the server on its
                                first connection (bounded retention; see prune_first_sync)
"""
import glob
import hashlib
import http.client
import json
import os
import re
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

DATA = os.environ.get('APP_DATA_DIR', '/data')
ORIGINS = set(os.environ.get('APP_ORIGINS', 'http://localhost:3013,http://127.0.0.1:3013').split(','))
KEY = re.compile(r'^pt-[A-Za-z0-9._-]{1,120}$')
MAX_BODY = 32 << 20
MAX_TOTAL = 96 << 20
KEEP_DAYS = 14
lock = threading.Lock()
items = {}
epoch = ''
load_error = False


def write_file(path, body):
    """Replace a file atomically, so a crash never leaves half-written data."""
    fd, temp = tempfile.mkstemp(prefix='.saving-', dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
        sync_directory(os.path.dirname(path))
    finally:
        if os.path.exists(temp):
            os.remove(temp)


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def load():
    global epoch, items, load_error
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, 'store.json')
    if os.path.exists(path):
        try:
            with open(path, encoding='utf-8') as handle:
                saved = json.load(handle)
            if not valid_items(saved['items']) or not isinstance(saved.get('epoch', ''), str):
                raise ValueError()
            items, epoch = saved['items'], saved.get('epoch', '')
        except (OSError, ValueError, KeyError, TypeError):
            load_error = True  # Keep the damaged file untouched and fail closed.
    prune_first_sync()
    if os.path.exists(os.path.join(DATA, 'operation.json')):
        try:
            finish_operation()
        except Exception:
            load_error = True


def revision(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def snapshot():
    return {'items': dict(items), 'epoch': epoch, 'revisions': {k: revision(v) for k, v in items.items()}}


def prune_first_sync():
    total = 0
    for index, path in enumerate(sorted(glob.glob(os.path.join(DATA, 'first-sync', '*.json')), reverse=True)):
        stat = os.stat(path)
        total += stat.st_size
        if index > 0 and (index >= 20 or total > 128 << 20 or time.time() - stat.st_mtime > 30 * 86400):
            os.remove(path)


def recovery_copies():
    copies = {}
    for pattern in ['daily/store-*.json', 'first-sync/*.json']:
        for path in glob.glob(os.path.join(DATA, pattern)):
            try:
                with open(path, encoding='utf-8') as handle:
                    saved = json.load(handle)['items']
                if valid_items(saved):
                    copies[os.path.relpath(path, DATA).replace(os.sep, '/')] = saved
            except (OSError, ValueError, KeyError, TypeError):
                pass
    return copies


def finish_operation():
    """Roll forward durable intent. No requests pass the gate until all stages finish."""
    global items, epoch, load_error
    from account_data import account, replace_account
    path = os.path.join(DATA, 'operation.json')
    with open(path, encoding='utf-8') as handle:
        op = json.load(handle)
    if not valid_items(op['items']) or not op['epoch']:
        raise ValueError('Invalid operation')
    if op.get('account') is not None:
        with account() as (cur, email):
            replace_account(cur, email, op['account'])
    write_file(os.path.join(DATA, 'store.json'), json.dumps({'version': 1, 'items': op['items'], 'epoch': op['epoch']}).encode())
    if op['reset']:
        from urllib.request import Request, urlopen
        origin = sorted(ORIGINS)[0]
        req = Request(os.environ.get('SESSION_SERVICE', 'http://youtube-account:8080') + '/session', method='DELETE',
                      headers={'Content-Type': 'application/json', 'Host': urlsplit(origin).netloc, 'Origin': origin})
        with urlopen(req, timeout=10) as response:
            if response.status != 200:
                raise OSError('Hash removal failed')
        for pattern in ['daily/store-*.json', 'first-sync/*.json', 'store.unreadable-*.json']:
            for name in glob.glob(os.path.join(DATA, pattern)):
                os.remove(name)
        for folder in ['daily', 'first-sync']:
            if os.path.isdir(os.path.join(DATA, folder)):
                sync_directory(os.path.join(DATA, folder))
    os.remove(path)
    sync_directory(DATA)
    items, epoch, load_error = op['items'], op['epoch'], False



def keep_daily_copy():
    current = os.path.join(DATA, 'store.json')
    if not os.path.exists(current):
        return
    daily = os.path.join(DATA, 'daily')
    os.makedirs(daily, exist_ok=True)
    today = os.path.join(daily, 'store-' + time.strftime('%Y-%m-%d') + '.json')
    if os.path.exists(today):
        return
    with open(current, 'rb') as handle:
        write_file(today, handle.read())
    for old in sorted(glob.glob(os.path.join(daily, 'store-*.json')))[:-KEEP_DAYS]:
        os.remove(old)


def write_first_sync(backup):
    folder = os.path.join(DATA, 'first-sync')
    os.makedirs(folder, exist_ok=True)
    name = time.strftime('%Y%m%d-%H%M%S') + '-' + str(time.time_ns()) + '.json'
    body = json.dumps({'saved': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'items': backup}, indent=1).encode()
    write_file(os.path.join(folder, name), body)
    prune_first_sync()


def valid_items(value):
    return isinstance(value, dict) and all(isinstance(k, str) and KEY.match(k) and (v is None or isinstance(v, str)) for k, v in value.items())


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, data):
        body = json.dumps(data, separators=(',', ':')).encode()
        self.send_response(status)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def ready(self):
        global load_error
        if os.path.exists(os.path.join(DATA, 'operation.json')):
            try:
                finish_operation()
            except Exception:
                load_error = True
        if load_error:
            self.reply(503, {'code': 'recovery', 'message': 'Saved data needs recovery. Open Menu → Recover saved data. Saving is paused.'})
            return False
        return True

    def do_GET(self):
        if self.headers.get('X-App-Proxy') == '1':
            return self.proxy()
        with lock:
            if urlsplit(self.path).path == '/recovery':
                return self.reply(200, {'required': load_error, 'copies': [{'id': k, 'count': len(v)} for k, v in recovery_copies().items()]})
            if urlsplit(self.path).path != '/items':
                return self.reply(404, {'message': 'Not found.'})
            if self.ready():
                self.reply(200, snapshot())

    def proxy(self):
        # Gateway sends all native writes here, plus GET routes with account side effects.
        # Hold the same lock as import/reset through the complete upstream response.
        with lock:
            if not self.ready():
                return
            path = urlsplit(self.path).path
            native_read = self.command in ('GET', 'HEAD') and path in ('/watch', '/feed/subscriptions')
            from urllib.parse import parse_qs
            supplied = self.headers.get('X-App-Epoch')
            if supplied is None:
                supplied = parse_qs(urlsplit(self.path).query, keep_blank_values=True).get('_app_epoch', [None])[0]
            body = b''
            length = int(self.headers.get('Content-Length', 0))
            if not 0 <= length <= 32 << 20:
                return self.reply(413, {'message': 'Request is too large.'})
            if length:
                body = self.rfile.read(length)
                if supplied is None and 'application/x-www-form-urlencoded' in self.headers.get('Content-Type', ''):
                    supplied = parse_qs(body.decode(), keep_blank_values=True).get('_app_epoch', [None])[0]
            if not native_read and self.headers.get('Origin') not in ORIGINS:
                # Same-origin GET navigation has no Origin header; validate Referer instead.
                referer = urlsplit(self.headers.get('Referer', ''))
                if self.command != 'GET' or referer.scheme + '://' + referer.netloc not in ORIGINS:
                    return self.reply(403, {'message': 'Local app only.'})
            if (supplied is not None and supplied != epoch) or (not native_read and supplied is None):
                return self.reply(409, {'message': 'This page is out of date. Reload before saving.', 'code': 'epoch'})
            is_session = path.startswith('/youtube-account/')
            conn = http.client.HTTPConnection('youtube-account' if is_session else 'invidious', 8080 if is_session else 3000, timeout=90)
            hop = {'connection', 'transfer-encoding', 'host', 'cookie', 'x-app-proxy', 'x-app-epoch', 'content-length'}
            headers = {k: v for k, v in self.headers.items() if k.lower() not in hop}
            headers['Host'] = self.headers.get('Host', '')
            if not is_session:
                headers['Cookie'] = self.headers.get('Cookie', '')
            target = self.path[len('/youtube-account'):] if is_session else self.path
            try:
                conn.request(self.command, target, body=body, headers=headers)
                response = conn.getresponse()
                payload = response.read()
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in {'transfer-encoding', 'connection', 'content-length'}:
                        self.send_header(key, value)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except (OSError, http.client.HTTPException):
                self.reply(502, {'message': 'The local service did not respond.'})
            finally:
                conn.close()

    do_DELETE = proxy
    do_PATCH = proxy
    do_PUT = proxy

    def do_POST(self):
        global items, epoch
        if self.headers.get('X-App-Proxy') == '1':
            return self.proxy()
        path = urlsplit(self.path).path
        # Only this app's own pages may write: other websites cannot forge a same-origin JSON POST.
        if (path not in ['/items', '/export', '/import', '/reset', '/recover', '/temporary'] or self.headers.get('Origin') not in ORIGINS
                or self.headers.get('Host') != urlsplit(self.headers.get('Origin', '')).netloc
                or not (self.headers.get('Content-Type') or '').startswith('application/json')):
            return self.reply(403, {'message': 'Local app only.'})
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= (MAX_BODY if path == '/items' else 100 << 20):
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError()
            if path != '/items':
                return self.manage(path, data)
            changes, backup = data.get('items') or {}, data.get('backup') or {}
            if not valid_items(changes) or not valid_items(backup):
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            return self.reply(400, {'message': 'Invalid data.'})
        with lock:
            if not self.ready():
                return
            if data.get('epoch', '') != epoch:
                return self.reply(409, {'message': 'Data was imported or cleared. Reload this page.', 'epoch': epoch})
            base = data.get('base', {})
            if not isinstance(base, dict):
                return self.reply(400, {'message': 'Invalid revisions.'})
            conflicts = [k for k in changes if base.get(k, '') != (revision(items[k]) if k in items else '')]
            if conflicts:
                return self.reply(409, {**snapshot(), 'code': 'conflict', 'conflicts': conflicts,
                                        'message': 'Another browser changed this collection. Choose which version to keep.'})
            try:
                if backup:
                    write_first_sync(backup)
                if changes:
                    merged = {**items, **changes}
                    body = json.dumps({'version': 1, 'items': merged, 'epoch': epoch}, separators=(',', ':')).encode()
                    if len(body) > MAX_TOTAL:
                        return self.reply(413, {'message': 'Saved data is too large.'})
                    keep_daily_copy()
                    write_file(os.path.join(DATA, 'store.json'), body)
                    items = merged
            except OSError:
                return self.reply(500, {'message': 'Could not save.'})
            self.reply(200, snapshot())

    def manage(self, path, data):
        global items, epoch, load_error
        from account_data import account, export_account, replace_account, validate_account, empty_account
        with lock:
            if path == '/recover':
                if os.path.exists(os.path.join(DATA, 'operation.json')):
                    if not self.ready():
                        return
                selected = recovery_copies().get(data.get('id'))
                if data.get('confirm') != 'RECOVER' or selected is None:
                    return self.reply(400, {'message': 'Choose an available recovery copy.'})
                try:
                    current = os.path.join(DATA, 'store.json')
                    if os.path.exists(current):
                        with open(current, 'rb') as handle:
                            write_file(os.path.join(DATA, 'store.unreadable-' + time.strftime('%Y%m%d-%H%M%S') + '.json'), handle.read())
                    op = {'items': selected, 'epoch': uuid.uuid4().hex, 'account': None, 'reset': False}
                    write_file(os.path.join(DATA, 'operation.json'), json.dumps(op).encode())
                    finish_operation()
                    return self.reply(200, snapshot())
                except Exception:
                    load_error = True
                    return self.reply(503, {'message': 'Recovery is pending. Restart the app and retry.'})
            if not self.ready():
                return
            if data.get('epoch', '') != epoch:
                return self.reply(409, {'message': 'Data changed. Reload before continuing.'})
            if path == '/temporary':
                if not isinstance(data.get('clear', False), bool):
                    return self.reply(400, {'message': 'Invalid storage request.'})
                try:
                    with account() as (cur, email):
                        cur.execute("SET LOCAL statement_timeout = '10s'")
                        # Only the regenerable detail cache, never channel_videos,
                        # follows, watched IDs or playlist records.
                        if data.get('clear'):
                            cur.execute('DELETE FROM videos')
                        cur.execute('SELECT count(*), coalesce(sum(octet_length(id) + coalesce(octet_length(info), 0)), 0) FROM videos')
                        count, size = cur.fetchone()
                    return self.reply(200, {'bytes': int(size), 'count': count, 'label': 'Cached video details',
                                            'note': 'Database space is reused after clearing; its disk file may not shrink.'})
                except Exception:
                    return self.reply(503, {'message': 'Could not access the video detail cache. Try again.'})
            reset = path == '/reset'
            if reset and data.get('confirm') != 'CLEAR EVERYTHING':
                return self.reply(400, {'message': 'Confirm Clear everything in the Menu.'})
            try:
                if path == '/export':
                    with account() as (cur, email):
                        saved_account = export_account(cur, email)
                    return self.reply(200, {'format': 'myapps-info', 'version': 1, 'app': 'individuous',
                                           'saved': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                                           'items': items, 'account': saved_account})
                if path == '/import':
                    backup = data.get('backup')
                    if (not isinstance(backup, dict) or backup.get('format') != 'myapps-info'
                            or backup.get('version') != 1 or backup.get('app') != 'individuous'
                            or not valid_items(backup.get('items'))):
                        raise ValueError('Choose an Individuous info export (version 1).')
                    next_items, next_account = backup['items'], validate_account(backup.get('account'))
                else:
                    next_items, next_account = {}, empty_account()
                op = {'items': next_items, 'account': next_account, 'epoch': uuid.uuid4().hex, 'reset': reset}
                body = json.dumps(op).encode()
                if len(body) > MAX_TOTAL:
                    return self.reply(413, {'message': 'Backup is too large.'})
                # Validate all database constraints before persisting intent; no changes commit.
                with account() as (cur, email):
                    replace_account(cur, email, next_account)
                    cur.connection.rollback()
                write_file(os.path.join(DATA, 'operation.json'), body)
                load_error = True
                finish_operation()
                return self.reply(200, snapshot())
            except ValueError as error:
                return self.reply(400, {'message': str(error)})
            except Exception:
                return self.reply(503, {'message': 'Operation could not finish. If started, it is saved for automatic recovery; saving stays paused until it finishes.'})


if __name__ == '__main__':
    load()
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('APP_DATA_PORT', '8080'))), Handler).serve_forever()
