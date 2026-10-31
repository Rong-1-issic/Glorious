import json,os,tempfile,threading,unittest
from pathlib import Path
from unittest.mock import patch
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from server import Store,Service,Fault,fetch_github,fetch_hn,fetch_socialcrawl,risk_scan

class BackendTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'test.sqlite3');self.w='test_workspace_123'
 def tearDown(self):self.tmp.cleanup()
 def sample(self):return {'id':'c_1','text':'not sticky moisturizer','source':'user','url':'https://example.com','date':'','mode':'imported','title':'product','kind':'review'}
 def test_idempotency_isolation_and_evidence(self):
  self.store.seed(self.w);self.store.ingest(self.w,[self.sample()],'imported');r=self.store.ingest(self.w,[self.sample()],'imported');self.assertEqual((r['added'],r['updated']),(0,1));self.assertEqual(self.store.read('comments','other_workspace'),[])
  answer=self.store.answer(self.w,'not sticky moisturizer');self.assertEqual(answer['mode'],'retrieval');self.assertEqual(answer['citations'][0]['record_id'],'c_1');self.assertIn('非模型',answer['label'])
 def test_no_evidence_and_missing_model_are_honest(self):
  self.assertEqual(self.store.answer(self.w,'quantum blueberry potato')['citations'],[])
  with patch.dict(os.environ,{},clear=True):
   with self.assertRaises(Fault) as r:self.store.answer(self.w,'hello','model')
   self.assertEqual(r.exception.code,'missing_model')
 def test_hn_normalizes_without_html_or_demographics(self):
  seen=[]
  def transport(url):seen.append(url);return {'hits':[{'objectID':'42','comment_text':'<p>not sticky<script>bad()</script></p>','created_at':'2026-10-01'}],'nbHits':1}
  rows,meta=fetch_hn('skin care',transport);self.assertEqual(rows[0]['text'],'not sticky');self.assertIn('query=skin+care',seen[0]);self.assertNotIn('nationality',rows[0]);self.assertIn('不是完整',meta['coverage'])
 def test_github_first_back_dedupe_and_unsupported_paths(self):
  comment={'__typename':'IssueComment','id':'C1','body':'actual comment','createdAt':'2026-01-01','url':'https://github.com/o/r/issues/1#issuecomment-1'}
  issue={'id':'I1','body':'product feedback','title':'issue','createdAt':'2026-01-01','timelineItems':{'edges':[{'node':comment}],'pageInfo':{'hasNextPage':True}},'backTimelineItems':{'edges':[{'node':comment}],'pageInfo':{}}}
  block={'payload':{'issueViewerRoute':{'data':{'repository':{'issue':issue}}}}};html='<script type="application/json">'+json.dumps(block)+'</script>'
  rows,meta=fetch_github('https://github.com/o/r/issues/1',lambda u:html);self.assertEqual(len(rows),2);self.assertEqual(meta['reply_count'],1);self.assertTrue(meta['partial_window'])
  for url in ('http://github.com/o/r/issues/1','https://github.com.evil.test/o/r/issues/1','https://127.0.0.1/x','https://user:pw@github.com/o/r/issues/1'):
   with self.assertRaises(Fault):fetch_github(url,lambda u:html)
 def test_socialcrawl_shapes_and_caches_no_key_no_request(self):
  def transport(*args):return {'success':True,'cached':True,'credits_used':0,'data':{'items':[{'comment':{'id':'c1','text':'raw markdown **nice**'},'replies':[{'comment':{'id':'c2','text':'reply'}}]}],'truncated':True}}
  rows,meta=fetch_socialcrawl('https://www.reddit.com/r/test/comments/abc/title/','fake-test-key',transport);self.assertEqual(len(rows),2);self.assertTrue(meta['provider_cached'])
  with self.assertRaises(Fault) as r:fetch_socialcrawl('https://www.reddit.com/r/test/comments/abc/','',lambda *a:self.fail('unexpected request'))
  self.assertEqual(r.exception.code,'missing_socialcrawl_key')
 def test_refresh_failure_preserves_old_and_does_not_mark_success(self):
  self.store.ingest(self.w,[self.sample()],'imported');s={'id':'s_1','provider':'hn','target':'skin','attempt_ts':0,'auto_refresh':False,'meta':{}}
  self.store.put('sources',self.w,s)
  def bad(*args):raise Fault('network_policy','blocked',502)
  with self.assertRaises(Fault):self.store.refresh(self.w,'s_1',bad)
  result=self.store.read('sources',self.w)[0];self.assertEqual(result['status'],'error');self.assertNotIn('last_success',result);self.assertEqual(len(self.store.read('comments',self.w)),1)
  with self.assertRaises(Fault) as r:self.store.refresh(self.w,'s_1',bad)
  self.assertEqual(r.exception.code,'cooldown')
 def test_restart_recovers_interrupted_refresh(self):
  self.store.put('sources',self.w,{'id':'interrupted','status':'refreshing','attempt_ts':123,'last_success':'old-success'})
  restarted=Store(self.store.path);source=restarted.read('sources',self.w)[0]
  self.assertEqual(source['status'],'error');self.assertEqual(source['error_code'],'interrupted');self.assertEqual(source['last_success'],'old-success');self.assertEqual(source['attempt_ts'],0)
 def test_single_source_concurrency(self):
  self.store.put('sources',self.w,{'id':'s','provider':'hn','target':'x','attempt_ts':0});self.store.jobs.add((self.w,'s'))
  with self.assertRaises(Fault) as r:self.store.refresh(self.w,'s')
  self.assertEqual(r.exception.code,'refresh_busy')
 def test_builtin_markdown_refreshes_without_resetting_user_documents(self):
  root=Path(self.tmp.name)/'app';(root/'knowledge').mkdir(parents=True);file=root/'knowledge/project.md';file.write_text('first source')
  with patch('server.ROOT',root):
   self.store.seed(self.w);self.store.put('documents',self.w,{'id':'user_doc','text':'user facts'})
   file.write_text('updated source');self.store.seed(self.w)
  docs=self.store.read('documents',self.w);self.assertEqual(len(docs),2);self.assertEqual(next(d['text'] for d in docs if d['id']=='kb_project'),'updated source')
 def test_risk_does_not_claim_compliance(self):self.assertGreaterEqual(len(risk_scan('Guaranteed cure in 7 days')),3)
 def test_http_csrf_limits_knowledge_and_export(self):
  service=Service(('127.0.0.1',0),self.store);thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start();base='http://127.0.0.1:'+str(service.server_port)
  def call(path,data=None,headers=None):
   if data is None:
    with urlopen(base+path+'?workspace_id='+self.w) as r:return json.load(r)
   req=Request(base+path,data=json.dumps({'workspace_id':self.w,**data}).encode(),headers={'Content-Type':'application/json',**(headers or {})})
   with urlopen(req) as r:return json.load(r)
  try:
   self.assertEqual(call('/api/status')['backend'],'ready')
   with self.assertRaises(HTTPError) as r:call('/api/knowledge',{'title':'x','text':'test'},headers={'Origin':'https://evil.example'})
   self.assertEqual(r.exception.code,403)
   doc=call('/api/knowledge',{'title':'成分表','text':'Contains oat extract','category':'成分材料'})['document'];self.assertEqual(doc['status'],'用户提供，待人工核对')
   answer=call('/api/assistant',{'question':'oat extract','context':{'market':'美国','language':'英语'}});self.assertEqual(answer['context']['market'],'美国');self.assertEqual(answer['citations'][0]['record_id'],doc['id'])
   with self.assertRaises(HTTPError):call('/api/sources',{'provider':'socialcrawl','target':'https://www.reddit.com/r/t/comments/abc/title'})
   call('/api/comments/import',{'comments':[{'text':'hello'},{'text':''}]});export=call('/api/export');self.assertEqual(len(export['comments']),1);self.assertEqual(len(export['documents']),2)
  finally:service.shutdown();service.server_close();thread.join()
if __name__=='__main__':unittest.main(verbosity=2)
