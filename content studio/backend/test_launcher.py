import json,sys,tempfile,threading,unittest
from pathlib import Path
from unittest.mock import patch
from urllib.request import urlopen
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.server import Service,Store
from start import check_existing,LaunchError,open_page

class LauncherTests(unittest.TestCase):
 def test_real_health_does_not_require_workspace_and_launcher_reuses_service(self):
  with tempfile.TemporaryDirectory() as d:
   server=Service(('127.0.0.1',0),Store(Path(d)/'db.sqlite3'));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
   try:
    with urlopen(f'http://127.0.0.1:{server.server_port}/api/health') as r:health=json.load(r)
    self.assertEqual(health['service'],'content-studio');self.assertEqual(health['api_version'],1);self.assertTrue(check_existing(server.server_port))
   finally:server.shutdown();server.server_close();thread.join()
 def test_launcher_refuses_unrelated_service(self):
  with patch('start.urlopen') as request:
   request.return_value.__enter__.return_value.read.return_value=b'{"service":"other","api_version":1,"status":"ready"}'
   with self.assertRaises(LaunchError):check_existing(8040)
 def test_browser_open_failure_is_reported_without_claiming_success(self):
  with patch('start.webbrowser.open',return_value=False),patch('builtins.print') as report:
   open_page('http://127.0.0.1:8040/');self.assertIn('浏览器未自动打开',report.call_args.args[0])
if __name__=='__main__':unittest.main(verbosity=2)
