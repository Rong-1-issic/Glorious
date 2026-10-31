"""Start the local backend and open its connected HTML. Python standard library only."""
from __future__ import annotations
import argparse,json,sys,threading,webbrowser
from pathlib import Path
from urllib.error import HTTPError,URLError
from urllib.request import urlopen
from backend.server import Service,Store,schedule

class LaunchError(Exception):pass

def check_existing(port):
    if port==0:return False
    try:
        with urlopen(f'http://127.0.0.1:{port}/api/health',timeout=2) as r:health=json.load(r)
    except HTTPError:raise LaunchError('端口已有其他服务，请使用 --port 指定空闲端口。') from None
    except (ValueError,UnicodeError):raise LaunchError('端口响应不是 content studio 后端，请更换端口。') from None
    except (URLError,TimeoutError,OSError):return False
    if not isinstance(health,dict) or health.get('service')!='content-studio' or health.get('api_version')!=1 or health.get('status')!='ready':raise LaunchError('该端口的服务版本不匹配，请更换端口。')
    return True

def open_page(url):
    try:
        if not webbrowser.open(url,new=2):print('浏览器未自动打开，服务地址：'+url,flush=True)
    except webbrowser.Error:print('浏览器未自动打开，服务地址：'+url,flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8040)
    parser.add_argument('--no-browser',action='store_true',help='启动服务但不打开浏览器')
    parser.add_argument('--db',type=Path,default=Path(__file__).resolve().parent/'.runtime'/'studio.sqlite3')
    args=parser.parse_args()
    if not 0<=args.port<=65535:parser.error('端口应为 0 至 65535')
    try:
        if check_existing(args.port):
            url=f'http://127.0.0.1:{args.port}/'
            print('content studio 后端已运行，HTML 与 API 共用同一地址：'+url,flush=True)
            if not args.no_browser:open_page(url)
            return 0
        store=Store(args.db)
        try:server=Service(('127.0.0.1',args.port),store)
        except OSError:raise LaunchError('无法绑定端口，请检查占用情况或使用 --port 更换端口。') from None
        stop=threading.Event();threading.Thread(target=schedule,args=(store,stop),daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/'
        print('content studio 已启动，已连接的 HTML：'+url,flush=True)
        if not args.no_browser:
            def when_ready():
                try:
                    if check_existing(server.server_port):open_page(url)
                except LaunchError:pass
            threading.Thread(target=when_ready,daemon=True).start()
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:stop.set();server.server_close()
        return 0
    except LaunchError as e:print(str(e),file=sys.stderr);return 1

if __name__=='__main__':raise SystemExit(main())
