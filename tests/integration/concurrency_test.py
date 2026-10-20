import json, threading, time, urllib.request

def req(path, body, epoch=None):
    h={'Host':'localhost:3020','Origin':'http://localhost:3020','Content-Type':'application/json'}
    if epoch is not None:h.update({'X-App-Proxy':'1','X-App-Epoch':epoch})
    request=urllib.request.Request('http://appdata:8080'+path,headers=h,data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(request,timeout=20) as response:
        body=response.read();return json.loads(body) if body else {}
current=req('/items',None)
errors=[]
def native():
    try:req('/preferences',{},current['epoch'])
    except Exception as error:errors.append(error)
t=threading.Thread(target=native);t.start();time.sleep(.3)
reset=req('/reset',{'epoch':current['epoch'],'confirm':'CLEAR EVERYTHING'})
t.join();assert not errors,errors
saved=req('/export',{'epoch':reset['epoch']})
assert saved['account']['watched']==[],saved['account']['watched']
print('PASS: concurrent native account write completes before reset; no data is resurrected after reset.')
