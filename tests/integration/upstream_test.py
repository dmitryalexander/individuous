import json, time, threading, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from contextlib import contextmanager
import psycopg

# Fake upstream writes use only the disposable database. The gateway gate is real.
class Upstream(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        Path('/tmp/entered').write_text('1')
        time.sleep(1)
        with psycopg.connect(host='invidious-db',dbname='invidious',user='kemal',password='synthetic-test-only') as conn:
            conn.execute("UPDATE users SET watched=ARRAY['aaaaaaaaaaa'] WHERE email='test@local'")
        self.send_response(204);self.end_headers()
ThreadingHTTPServer(('0.0.0.0',3000),Upstream).serve_forever()
