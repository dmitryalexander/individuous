"""Exercise real saved-data HTTP and restart behavior using disposable directories."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, ProxyHandler, build_opener


class SavedDataTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix='individuous-preview-test-')
        self.addCleanup(self.folder.cleanup)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        self.process = None
        self.addCleanup(self.stop)
        self.start()

    def start(self):
        env = dict(os.environ, APP_DATA_DIR=self.folder.name,
                   APP_DATA_PORT=str(self.port), APP_ORIGINS='http://localhost:3013')
        script = Path(__file__).resolve().parents[1] / 'appdata' / 'store.py'
        self.process = subprocess.Popen([sys.executable, str(script)], env=env,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        failure = None
        for _ in range(100):
            try:
                self.request()
                return
            except (OSError, HTTPError) as error:
                failure = error
                if self.process.poll() is not None:
                    self.fail(self.process.stderr.read().decode())
                time.sleep(0.05)
        self.fail(f'Saved-data test server did not respond: {failure}')

    def stop(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=10)
        if self.process and self.process.stderr:
            self.process.stderr.close()

    def request(self, body=None, origin='http://localhost:3013'):
        data = json.dumps(body).encode() if body is not None else None
        req = Request(f'http://127.0.0.1:{self.port}/items', data=data,
                      headers={'Content-Type': 'application/json', 'Origin': origin, 'Host': 'localhost:3013'})
        with build_opener(ProxyHandler({})).open(req, timeout=3) as response:
            return json.load(response)

    def test_fresh_store_restart_merge_and_deletion(self):
        self.assertEqual(self.request(), {'items': {}, 'epoch': '', 'revisions': {}})
        fixture = {'pt-video-lists-v1': '{"lists":[{"id":"test","name":"Test","videos":[]}]}',
                   'pt-search-term-lists-v1': '{"lists":[]}',
                   'pt-following-groups-v1': '{"activeId":"all","lists":[{"id":"all","name":"All following","channels":[]}]}'}
        self.request({'items': fixture})
        self.stop()
        self.start()
        self.assertEqual(self.request()['items'], fixture)
        self.request({'items': {'pt-external-tools-v1': '{"transcript":"https://example.com/{id}"}'}})
        self.assertEqual(self.request()['items']['pt-video-lists-v1'], fixture['pt-video-lists-v1'])
        self.request({'items': {'pt-external-tools-v1': None}, 'base': self.request()['revisions']})
        self.assertIsNone(self.request()['items']['pt-external-tools-v1'])

    def test_two_browsers_cannot_overwrite_each_other(self):
        self.request({'items': {'pt-video-lists-v1': 'start'}})
        base = self.request()['revisions']
        self.request({'items': {'pt-video-lists-v1': 'browser A'}, 'base': base})
        with self.assertRaises(HTTPError) as rejected:
            self.request({'items': {'pt-video-lists-v1': 'browser B'}, 'base': base})
        self.assertEqual(rejected.exception.code, 409)
        self.assertEqual(self.request()['items']['pt-video-lists-v1'], 'browser A')
        self.request({'items': {'pt-inline-volume-v1': '0.5'}, 'base': base})
        self.assertEqual(self.request()['items']['pt-inline-volume-v1'], '0.5')

    def test_installed_origin_and_invalid_writes_cannot_change_preview_data(self):
        self.request({'items': {'pt-video-lists-v1': 'saved'}})
        with self.assertRaises(HTTPError) as rejected:
            self.request({'items': {'pt-video-lists-v1': 'wrong origin'}}, 'http://localhost:3012')
        self.assertEqual(rejected.exception.code, 403)
        with self.assertRaises(HTTPError) as rejected:
            self.request({'items': {'pt-video-lists-v1': {'invalid': 'object'}}})
        self.assertEqual(rejected.exception.code, 400)
        self.assertEqual(self.request()['items'], {'pt-video-lists-v1': 'saved'})


if __name__ == '__main__':
    unittest.main()
