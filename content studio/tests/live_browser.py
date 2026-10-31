from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os,tempfile,shutil
base=os.environ.get('STUDIO_LIVE_URL','http://127.0.0.1:8040');out=Path(tempfile.mkdtemp(prefix='studio-live-e2e-'))
with sync_playwright() as pw:
 browser_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome');b=pw.chromium.launch(**({'executable_path':browser_path} if browser_path else {}),args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=ctx.new_page();errors=[];expected_failure={'active':False}
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' and not (expected_failure['active'] and ('502' in m.text or 'net::ERR_FAILED' in m.text)) else None)
 page.goto(base);page.wait_for_function("document.getElementById('backend-state').textContent==='本机后端在线'")
 assert '知识检索可用' in page.locator('#ai-status').inner_text();assert page.locator('#document-list .document-item').count()==1
 # Live adapter: this actually reads github.com; no intercepted response.
 assert 'HTML 与本机 API 已连接' in page.locator('#connection-info').inner_text();assert page.locator('#assistant-mode option[value=model]').is_disabled()
 expected_failure['active']=True;page.route('**/api/health?**',lambda route:route.abort());page.locator('#retry-backend').click();page.wait_for_function("document.querySelector('#backend-state').textContent==='后端未连接'");assert page.locator('#quick-load').is_disabled()
 page.unroute('**/api/health?**');page.locator('#retry-backend').click();page.wait_for_function("document.querySelector('#backend-state').textContent==='本机后端在线'");expected_failure['active']=False
 page.locator('#quick-load').click();page.wait_for_selector('.source-item')
 page.wait_for_function("document.querySelector('#comment-count').textContent==='3'",timeout=45000)
 assert page.locator('.comment-item').count()==3
 page.locator('.source-item .text-button').first.click();page.wait_for_function("document.querySelector('.source-item').textContent.includes('暂停自动更新')")
 page.locator('.source-item .text-button').first.click();page.wait_for_function("document.querySelector('.source-item').textContent.includes('开启 5 分钟更新')")
 page.locator('.comment-item .text-button').first.click();assert page.locator('dialog[open] pre').inner_text();assert page.locator('dialog[open] a').get_attribute('href').startswith('https://github.com/')
 page.get_by_role('button',name='关闭',exact=True).click()
 page.locator('#question').fill('catalog workspace session-state');page.locator('#assistant-submit').click();page.wait_for_selector('.citation');assert '非模型' in page.locator('.conversation').inner_text()
 page.locator('.citation').first.click();assert page.locator('dialog[open] code').inner_text().startswith('github_');page.get_by_role('button',name='关闭',exact=True).click()
 page.locator('#document-title').fill('Test brand ingredients');page.locator('#document-category').select_option('成分材料');page.locator('#document-text').fill('Our supplied ingredient sheet lists oat extract. No efficacy claim is verified.');page.locator('#document-submit').click();page.wait_for_function("document.querySelector('#doc-count').textContent==='2'");assert page.locator('.message[data-expired=true]').count()>=1
 page.locator('#question').fill('oat extract');page.locator('#assistant-submit').click();page.wait_for_function("Array.from(document.querySelectorAll('.citation')).some(e=>e.textContent.includes('oat extract'))")
 assert 'oat extract' in page.locator('.citation').last.inner_text()
 page.get_by_text('导入已有评论',exact=True).click();page.locator('#import-comments').fill('<img src=x onerror=alert(1)> not sticky moisturizer\nnot sticky moisturizer');page.locator('#import-submit').click();page.wait_for_function("document.querySelector('#comment-count').textContent==='5'")
 page.locator('#comment-mode').select_option('imported');page.wait_for_function("document.querySelectorAll('.comment-item').length===2");assert page.locator('#comment-list img').count()==0
 with page.expect_download() as d:page.locator('#export-workspace').click()
 d.value.save_as(out/'workspace.json');data=json.loads((out/'workspace.json').read_text());assert len(data['comments'])==5 and len(data['documents'])==2
 page.reload();page.wait_for_function("document.querySelector('#comment-count').textContent==='5'");assert page.locator('.document-item').count()==2
 page.locator('#source-provider').select_option('hn');page.locator('#source-target').fill('moisturizer');page.locator('#add-source').click();page.wait_for_function("document.querySelectorAll('.source-item').length===2")
 expected_failure['active']=True;hn=page.locator('.source-item').filter(has_text='Hacker News');hn.locator('.secondary').click();page.wait_for_function("Array.from(document.querySelectorAll('.source-item')).some(e=>e.textContent.includes('Hacker News')&&(e.textContent.includes('刷新失败')||e.textContent.includes('上次成功')))",timeout=45000)
 if '刷新失败' in hn.inner_text():assert '5'==page.locator('#comment-count').inner_text()
 page.screenshot(path=str(out/'desktop.png'),full_page=True)
 for width in (1440,768,390,360):
  page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'mobile.png'),full_page=True)
 # Independent workspace cannot see this space's records.
 second=b.new_page();second.goto(base);second.wait_for_function("document.getElementById('backend-state').textContent==='本机后端在线'");assert second.locator('#comment-count').inner_text()=='0'
 assert not errors,errors
 print('PASS: health handshake, disconnect/reconnect, one-click frontend/backend connection, real internet collection (3 records, 2 replies), auto-refresh toggle, provenance dialog, evidence assistant, Markdown knowledge, safe text import, full export, persisted reload, honest network failure, workspace isolation and 1440/768/390/360 layouts; no unexpected page or console errors (intentional blocked-source HTTP 502 verified).')
 print('Artifacts:',out)
 b.close()
