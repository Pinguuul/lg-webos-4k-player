"""Exercise the actual helper against a generated, non-copyrighted media fixture."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

SPEC = importlib.util.spec_from_file_location('helper', Path(__file__).parents[1] / 'support.py')
helper = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(helper)


class HelperIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.base = Path(cls.temp.name)
        cls.media = cls.base / 'media'
        cls.media.mkdir()
        caption = cls.media / 'fixture.en.srt'
        caption.write_text('1\n00:00:00,100 --> 00:00:01,500\nSynthetic caption.\n', encoding='utf8')
        movie = cls.media / 'fixture.mkv'
        subprocess.run([
            'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
            '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1:d=2',
            '-i', str(caption), '-map', '0:v', '-map', '1:s',
            '-c:v', 'mpeg4', '-c:s', 'srt', '-t', '2', str(movie)
        ], check=True, timeout=30)
        outside = cls.base / 'outside.mkv'
        outside.write_bytes(movie.read_bytes())
        database = cls.base / 'files.db'
        with sqlite3.connect(database) as db:
            db.execute('CREATE TABLE DETAILS (ID INTEGER PRIMARY KEY, PATH TEXT)')
            db.executemany('INSERT INTO DETAILS VALUES (?,?)', [(1, str(movie)), (2, str(outside))])
        cls.settings = {
            'media_root': str(cls.media), 'database': str(database),
            'cache': str(cls.base / 'cache'), 'host': '127.0.0.1',
            'port': 18201, 'allowed_clients': ['127.0.0.1']
        }
        cls.config = cls.base / 'support.local.json'
        cls.config.write_text(json.dumps(cls.settings))
        helper.configure(cls.config)
        cls.server = helper.ThreadingHTTPServer(('127.0.0.1', 0), helper.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:%d' % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def get(self, endpoint):
        try:
            with urlopen(self.url + endpoint, timeout=10) as response:
                return response.status, response.read()
        except HTTPError as error:
            with error:
                return error.code, error.read()

    def test_health_and_metadata_do_not_expose_paths(self):
        self.assertEqual(self.get('/health'), (200, b'{"ok": true}'))
        status, body = self.get('/metadata?id=1')
        self.assertEqual(status, 200)
        tracks = json.loads(body)['tracks']
        self.assertTrue(any(track['key'].startswith('s') for track in tracks))
        self.assertTrue(any(track['label'] == 'External file en' for track in tracks))
        self.assertTrue(all('_path' not in track for track in tracks))
        self.assertNotIn(str(self.base).encode(), body)

    def test_embedded_and_external_tracks_convert_to_webvtt(self):
        tracks = json.loads(self.get('/metadata?id=1')[1])['tracks']
        for track in tracks:
            endpoint = '/subtitle?id=1&track=' + track['key']
            deadline = time.monotonic() + 15
            status, body = self.get(endpoint)
            while status == 202 and time.monotonic() < deadline:
                time.sleep(0.1)
                status, body = self.get(endpoint)
            self.assertEqual(status, 200, body)
            self.assertTrue(body.startswith(b'WEBVTT'))
            self.assertIn(b'Synthetic caption.', body)
            self.assertEqual(self.get(endpoint), (200, body))

    def test_media_root_and_id_validation(self):
        for endpoint in ['/metadata?id=2', '/metadata?id=1%20OR%201=1', '/subtitle?id=1&track=../../bad']:
            self.assertEqual(self.get(endpoint)[0], 400, endpoint)

    def test_client_allowlist(self):
        previous = helper.ALLOWED_CLIENTS
        try:
            helper.ALLOWED_CLIENTS = set()
            self.assertEqual(self.get('/health')[0], 403)
        finally:
            helper.ALLOWED_CLIENTS = previous

    def test_cache_cannot_be_inside_library(self):
        settings = dict(self.settings, cache=str(self.media / 'cache'))
        invalid = self.base / 'invalid.json'
        invalid.write_text(json.dumps(settings))
        try:
            with self.assertRaisesRegex(ValueError, 'outside the media root'):
                helper.configure(invalid)
        finally:
            helper.configure(self.config)


if __name__ == '__main__':
    unittest.main()
