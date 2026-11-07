"""Read-only MiniDLNA subtitle companion for the local LG player."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import hashlib, json, sqlite3, subprocess, threading, argparse, ipaddress, os

ROOT=None
CACHE=None
DATABASE=None
ALLOWED_CLIENTS=set()

def configure(path):
 global ROOT,CACHE,DATABASE,ALLOWED_CLIENTS
 config_path=Path(path).expanduser().resolve()
 with config_path.open() as handle: settings=json.load(handle)
 ROOT=Path(settings['media_root']).expanduser().resolve()
 if not ROOT.is_dir():raise ValueError('media_root must be an existing directory')
 DATABASE=Path(settings['database']).expanduser().resolve()
 if not DATABASE.is_file():raise ValueError('database must point to MiniDLNA files.db')
 CACHE=Path(settings['cache']).expanduser().resolve()
 if CACHE==ROOT or CACHE.is_relative_to(ROOT):raise ValueError('Keep the subtitle cache outside the media root')
 CACHE.mkdir(parents=True,exist_ok=True)
 ALLOWED_CLIENTS={str(ipaddress.ip_address(address)) for address in settings['allowed_clients']}
 if not ALLOWED_CLIENTS:raise ValueError('allowed_clients must include at least the TV address')
 host=str(ipaddress.IPv4Address(settings.get('host','127.0.0.1')))
 port=int(settings.get('port',18201))
 if not 1<=port<=65535:raise ValueError('Invalid port')
 return host,port

TEXT={'subrip','ass','ssa','webvtt','mov_text','text'}
metadata_cache={}; jobs={}; lock=threading.Lock(); slots=threading.Semaphore(2)

def media(media_id):
 if not str(media_id).isdigit():raise ValueError('Invalid media ID')
 with sqlite3.connect(DATABASE.as_uri()+'?mode=ro',uri=True,timeout=5) as db:
  row=db.execute('select PATH from DETAILS where ID=?',(int(media_id),)).fetchone()
 if not row or not row[0]:raise ValueError('The video is no longer in the catalogue')
 p=Path(row[0]).resolve()
 if not p.is_relative_to(ROOT) or not p.is_file():raise ValueError('File unavailable')
 st=p.stat();key=hashlib.sha256((str(p)+str(st.st_size)+str(st.st_mtime_ns)).encode()).hexdigest()
 return p,key

def describe(media_id):
 p,key=media(media_id)
 with lock:cached=metadata_cache.get(key)
 if cached:return p,key,cached
 result=subprocess.run(['ffprobe','-v','error','-select_streams','s','-show_entries','stream=index,codec_name:stream_tags=language,title','-of','json',str(p)],capture_output=True,text=True,timeout=40,check=True)
 tracks=[]
 for stream in json.loads(result.stdout).get('streams',[]):
  tags=stream.get('tags',{});codec=stream.get('codec_name','unknown');idx=stream['index']
  tracks.append({'key':'s'+str(idx),'language':tags.get('language','und'),'label':tags.get('title',''),'codec':codec,'supported':codec in TEXT})
 for ext in ('srt','vtt','ass','ssa'):
  for sidecar in sorted(p.parent.glob(p.stem+'*.'+ext)):
   sidecar=sidecar.resolve()
   if not sidecar.is_relative_to(ROOT):continue
   suffix=sidecar.stem[len(p.stem):].strip(' ._-')
   tracks.append({'key':'f'+str(len(tracks)),'language':suffix or 'und','label':'External file'+(' '+suffix if suffix else ''),'codec':ext,'supported':True,'_path':str(sidecar)})
 with lock:metadata_cache[key]=tracks
 return p,key,tracks

def convert(jobkey,p,track,out):
 try:
  with slots:
   tmp=out.with_suffix('.tmp')
   command=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-i',track.get('_path',str(p))]
   command+=['-map','0:0' if '_path' in track else '0:'+track['key'][1:],'-c:s','webvtt','-f','webvtt','-y',str(tmp)]
   subprocess.run(command,capture_output=True,timeout=240,check=True)
   tmp.replace(out)
  with lock:jobs[jobkey]='ready'
 except Exception:
  with lock:jobs[jobkey]='error'

def subtitle(media_id,track_key):
 p,key,tracks=describe(media_id);track=next((t for t in tracks if t['key']==track_key),None)
 if not track or not track['supported']:raise ValueError('This track is not text; it requires OCR and is unavailable in this player')
 jobkey=key+'-'+track_key;out=CACHE/(jobkey+'.vtt')
 if out.exists():return 200,out.read_bytes(),'text/vtt; charset=utf-8'
 with lock:
  state=jobs.get(jobkey)
  if state=='error':raise ValueError('Unable to extract the subtitle')
  if not state:
   jobs[jobkey]='running';threading.Thread(target=convert,args=(jobkey,p,track,out),daemon=True).start()
 return 202,json.dumps({'status':'preparing'}).encode(),'application/json'

class Handler(BaseHTTPRequestHandler):
 def reply(self,code,data,typ='application/json'):
  if not isinstance(data,bytes):data=json.dumps(data,ensure_ascii=False).encode()
  self.send_response(code);self.send_header('Content-Type',typ);self.send_header('Content-Length',str(len(data)));self.send_header('Access-Control-Allow-Origin','*');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
 def do_GET(self):
  if self.client_address[0] not in ALLOWED_CLIENTS:self.reply(403,{'error':'Forbidden'});return
  u=urlparse(self.path);q=parse_qs(u.query)
  try:
   if u.path=='/health':self.reply(200,{'ok':True});return
   mid=q.get('id',[''])[0]
   if u.path=='/metadata':
    _,_,tracks=describe(mid);self.reply(200,{'tracks':[{k:v for k,v in t.items() if not k.startswith('_')} for t in tracks]});return
   if u.path=='/subtitle':
    code,data,typ=subtitle(mid,q.get('track',[''])[0]);self.reply(code,data,typ);return
   self.reply(404,{'error':'Not found'})
  except ValueError as e:self.reply(400,{'error':str(e)})
  except Exception:self.reply(500,{'error':'Unable to read the video subtitles'})
 def log_message(self,*args):pass

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--config',required=True,help='Path to the private JSON configuration file')
 args=parser.parse_args()
 try:
  host,port=configure(args.config)
 except (OSError,ValueError,KeyError,TypeError) as error:
  parser.error(str(error))
 os.umask(0o077)
 print('Subtitle helper listening on %s:%s' % (host,port),flush=True)
 ThreadingHTTPServer((host,port),Handler).serve_forever()
