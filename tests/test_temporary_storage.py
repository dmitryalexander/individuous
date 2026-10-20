import sys, unittest
from pathlib import Path
from contextlib import contextmanager
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'appdata'))
import store
import account_data
class TemporaryStorageTest(unittest.TestCase):
 def test_only_detail_cache_is_cleared(self):
  queries=[]
  class Cursor:
   def execute(self,sql):queries.append(sql)
   def fetchone(self):return (0,0)
  @contextmanager
  def account():yield Cursor(),'fixture'
  handler=store.Handler.__new__(store.Handler);responses=[];handler.reply=lambda status,body:responses.append((status,body));handler.ready=lambda:True
  with patch.object(account_data,'account',account):
   handler.manage('/temporary',{'epoch':store.epoch,'clear':False})
   self.assertFalse(any(q.startswith('DELETE') for q in queries));queries.clear()
   handler.manage('/temporary',{'epoch':store.epoch,'clear':True})
   self.assertEqual([q for q in queries if q.startswith('DELETE')],['DELETE FROM videos'])
   self.assertEqual(responses[-1][0],200);self.assertEqual(responses[-1][1]['bytes'],0)
   queries.clear();handler.manage('/temporary',{'epoch':store.epoch,'clear':'yes'})
   self.assertEqual(responses[-1][0],400);self.assertEqual(queries,[])
