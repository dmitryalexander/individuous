import json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

def req(path, body=None, extra=None):
    headers={'Host':'localhost:3020','Origin':'http://localhost:3020','Content-Type':'application/json', **(extra or {})}
    request=urllib.request.Request('http://appdata:8080'+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload=response.read()
            return response.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as error:
        return error.code,json.load(error)

mode=sys.argv[1]
if mode=='fail-reset':
    code,current=req('/items'); assert code==200
    code,_=req('/reset',{'epoch':current['epoch'],'confirm':'CLEAR EVERYTHING'})
    assert code==503
    assert Path('/data/operation.json').exists()
    assert req('/items')[0]==503
    assert req('/preferences',{}, {'X-App-Proxy':'1','X-App-Epoch':current['epoch']})[0]==503
    print('PASS: interrupted reset leaves durable intent and blocks reads and native writes.')
elif mode=='recovered':
    code,current=req('/items'); assert code==200,current
    assert current['items']=={}
    assert not Path('/data/operation.json').exists()
    assert req('/preferences',{}, {'X-App-Proxy':'1','X-App-Epoch':'old'})[0]==409
    assert req('/preferences',{}, {'X-App-Proxy':'1'})[0]==409
    print('PASS: restart completes reset; old and unversioned native mutations are rejected.')
elif mode=='damage':
    folder=Path('/data/daily');folder.mkdir(exist_ok=True);os.chown(folder,65534,65534)
    copy=folder/'store-2026-10-20.json';copy.write_text(json.dumps({'items':{'pt-video-lists-v1':'recovered collection'}}));copy.chmod(0o644)
    Path('/data/store.json').write_text('{broken')
elif mode=='recover':
    assert req('/items')[0]==503
    assert req('/items',{'items':{'pt-video-lists-v1':'defaults'}})[0]==503
    assert Path('/data/store.json').read_text()=='{broken'
    code,choices=req('/recovery');assert code==200 and choices['required']
    chosen=next(c['id'] for c in choices['copies'] if c['id']=='daily/store-2026-10-20.json')
    code,current=req('/recover',{'id':chosen,'confirm':'RECOVER'})
    assert code==200,current
    assert current['items']['pt-video-lists-v1']=='recovered collection'
    assert list(Path('/data').glob('store.unreadable-*.json'))
    print('PASS: corruption fails closed; explicit recovery restores a selected copy and preserves damaged bytes.')
