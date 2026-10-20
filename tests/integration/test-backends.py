"""Only disposable containers on explicit test ports. Never point this at installed app ports."""
import json
import os
import urllib.request
import urllib.error

def req(port, path, body=None, method=None, origin=None):
    assert port in (3020, 3021)
    target = {3020:'appdata:8080',3021:'youtube-account:8080'}[port] if os.environ.get('TEST_INTERNAL') else f'127.0.0.1:{port}'
    url = f'http://{target}{path}'
    request = urllib.request.Request(url, method=method or ('POST' if body is not None else 'GET'),
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Origin':origin or f'http://localhost:{port}','Host':f'localhost:{port}','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=20) as r: return r.status,json.load(r)
    except urllib.error.HTTPError as e: return e.code,json.load(e)

assert req(3020,'/items')[1] == {'items':{},'epoch':'','revisions':{}}
assert req(3021,'/restore',{'cookie':'SAPISID=synthetic; SID=only-test'})[0] == 200
fixture = {'pt-video-lists-v1':'{"activeId":"test","lists":[{"id":"test","name":"Test","items":[{"id":"aaaaaaaaaaa","title":"Synthetic video"}]}]}',
           'pt-search-term-lists-v1':'{"activeId":"x","lists":[{"id":"x","name":"Ideas","terms":["synthetic"]}]}',
           'pt-inline-volume-v1':'0.4'}
assert req(3020,'/items',{'items':fixture})[0] == 200
code, exported = req(3020,'/export',{})
assert code == 200, exported
assert exported['items'] == fixture
assert not any(s in json.dumps(exported) for s in ['synthetic-password','synthetic-token','synthetic-test-session','SAPISID'])
exported['account']['subscriptions']=['UC'+'a'*22]
exported['account']['watched']=['aaaaaaaaaaa']
exported['account']['preferences']={'video_loop':True,'watch_history':False}
plid='IVPL'+'a'*31
exported['account']['playlists']=[{'title':'Native list','id':plid,'description':'Test','video_count':1,'created':'2026-10-20T00:00:00Z','updated':'2026-10-20T00:00:00Z','privacy':'Private','index':['9223372036854775806']}]
exported['account']['playlist_videos']=[{'title':'Native video','id':'aaaaaaaaaaa','author':'Creator','ucid':'UC'+'a'*22,'length_seconds':60,'published':'2026-10-20T00:00:00Z','plid':plid,'index':'9223372036854775806','live_now':False}]
wrong=dict(exported,app='pinful')
assert req(3020,'/import',{'backup':wrong})[0]==400
assert req(3020,'/items')[1]['items']==fixture
assert req(3020,'/reset',{})[0]==400
assert req(3020,'/export',{},origin='https://foreign.test')[0]==403
code,result=req(3020,'/import',{'backup':exported})
assert code==200,result
epoch=result['epoch']
assert req(3020,'/items',{'items':{'pt-video-lists-v1':'stale'}})[0]==409
code,roundtrip=req(3020,'/export',{'epoch':epoch})
assert code==200,roundtrip
assert roundtrip['items']==fixture
for key in ['subscriptions','watched','preferences']:
    assert roundtrip['account'][key]==exported['account'][key],key
assert roundtrip['account']['playlists'][0]['title']=='Native list'
assert roundtrip['account']['playlist_videos'][0]['index']=='9223372036854775806'
assert req(3021,'/export',{})[0]==200,'Info import cleared hash'
bad=json.loads(json.dumps(exported));bad['account']['playlists'][0]['created']='invalid-date'
assert req(3020,'/import',{'epoch':epoch,'backup':bad})[0]!=200
assert req(3020,'/export',{'epoch':epoch})[1]['account']==roundtrip['account'],'Failed import changed database'
code,reset=req(3020,'/reset',{'epoch':epoch,'confirm':'CLEAR EVERYTHING'})
assert code==200,reset
assert reset['items']=={} and reset['epoch']!=epoch
assert req(3021,'/export',{})[0]==404
assert req(3020,'/items',{'epoch':epoch,'items':fixture})[0]==409
code,empty=req(3020,'/export',{'epoch':reset['epoch']})
assert code==200
for key in ['subscriptions','watched','playlists','playlist_videos']:
    assert empty['account'][key]==[],key
assert 'video_loop' not in empty['account']['preferences']
print('PASS: export/import/reset include collections, native playlists, follows, history, settings; malformed imports roll back; cross-origin and stale writes blocked; reset clears hash.')
