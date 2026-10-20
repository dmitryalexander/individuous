"""Bound recovery storage without touching application volumes."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('retention_store', Path(__file__).resolve().parents[1] / 'appdata/store.py')
store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(store)


class RetentionTest(unittest.TestCase):
    def test_first_sync_keeps_twenty_newest(self):
        with tempfile.TemporaryDirectory() as folder:
            store.DATA = folder
            for i in range(25):
                store.write_first_sync({'pt-test-v1': str(i)})
            copies = list((Path(folder) / 'first-sync').glob('*.json'))
            self.assertEqual(len(copies), 20)
            self.assertIn('24', [json.loads(p.read_text())['items']['pt-test-v1'] for p in copies])

    def test_size_and_age_limits(self):
        with tempfile.TemporaryDirectory() as folder:
            store.DATA = folder
            copies = Path(folder) / 'first-sync'
            copies.mkdir()
            for i in range(3):
                with (copies / f'{i}.json').open('wb') as handle:
                    handle.truncate(70 << 20)  # Sparse test files; no personal contents.
            store.prune_first_sync()
            self.assertEqual([p.name for p in copies.iterdir()], ['2.json'])
            oldest = copies / '1.json'
            oldest.write_text('{}')
            ago = time.time() - 31 * 86400
            os.utime(oldest, (ago, ago))
            store.prune_first_sync()
            self.assertFalse(oldest.exists())
            self.assertTrue((copies / '2.json').exists())
