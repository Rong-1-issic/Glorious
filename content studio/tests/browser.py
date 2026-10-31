from playwright.sync_api import sync_playwright
import json,pathlib,os
out=pathlib.Path(os.environ.get('TEST_OUTPUT_DIR', str(pathlib.Path(__file__).resolve().parents[1]/'test-results')));out.mkdir(parents=True,exist_ok=True)
base=os.environ.get('BASE_URL','http://127.0.0.1:3001')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(base);page.get_by_role('button',name='载入演示项目').click()
 page.screenshot(path=str(out/'desktop-setup.png'),full_page=True)
 page.locator('nav button').nth(1).click();page.get_by_role('button',name='not sticky',exact=True).click()
 assert page.locator('.evidence-item').count()==2
 assert all('not sticky' in t.lower() for t in page.locator('.evidence-item blockquote').all_text_contents())
 page.get_by_role('button',name='关闭证据').click()
 page.get_by_label('传入下一步').first.check();page.locator('nav button').nth(2).click()
 assert '不黏腻' in page.locator('.focus').inner_text()
 page.get_by_role('button',name='添加策略').click()
 s=page.locator('.strategy');s.get_by_label('中文原表达').fill('本草养肤');s.get_by_label('消费者疑问').fill('想了解具体成分');s.get_by_role('button',name='确认此策略').click()
 page.locator('nav button').nth(3).click();page.get_by_role('button',name='生成三版演示故事',exact=True).click()
 page.wait_for_selector('.story-card');assert page.locator('.story-card').count()==3
 assert 'Lin' in page.locator('.story-card').nth(0).locator('.sentence textarea').nth(2).input_value()
 c=page.locator('.story-card').nth(2);assert c.locator('.sentence').count()==3
 c.get_by_role('button',name='查看依据').first.click();assert page.locator('.evidence-item').count()>=2
 page.get_by_role('button',name='关闭证据').click()
 c.get_by_role('button',name='重新检查').click();assert '本轮发现' in c.locator('.check-status').inner_text()
 c.locator('.sentence textarea').nth(0).fill('Guaranteed cure in 7 days.')
 assert '失效' in c.locator('.check-status').inner_text()
 c.get_by_role('button',name='重新检查').click();assert '医疗性' in c.inner_text()
 c.locator('.sentence textarea').nth(0).fill('Meet Qingyu, a daily moisturizer.')
 c.get_by_role('button',name='重新检查').click();c.get_by_role('button',name='保存版本',exact=True).click();c.get_by_role('button',name='选定此版').click()
 page.get_by_role('button',name='派生产品介绍与社媒短帖').click()
 page.locator('nav button').nth(4).click();page.get_by_role('button',name='创建 / 重建三版实验卡').click();assert page.locator('.experiment').count()==3
 for button,name in [('完整项目 JSON','project.json'),('句子证据 CSV','evidence.csv'),('Markdown 内容包','package.md'),('实验卡 CSV','experiments.csv')]:
  with page.expect_download() as dl:page.get_by_role('button',name=button,exact=True).click()
  dl.value.save_as(out/name)
 data=json.loads((out/'project.json').read_text());assert len(data['experiments'])==3
 facts={f['id'] for f in data['facts']};comments={c['id'] for c in data['comments']}
 for v in data['versions']:
  for s in v['sentences']:assert set(s['factIds'])<=facts and set(s['commentIds'])<=comments
 page.wait_for_timeout(700);page.reload();assert '青屿' in page.locator('.breadcrumbs').inner_text()
 page.locator('nav button').nth(0).click();page.get_by_role('button',name='创建新项目',exact=True).click()
 custom='\ufeffbody,source,comment_id,url,date,language\r\n"Not sticky, pleasant\ntexture",Store,C1,https://example.com,2026-10-30,en\r\n"Not sticky, pleasant\ntexture",Interview,C2,javascript:alert(1),,en\r\nDry skin.,Store,C3,,,en\r\n,Store,C4,,,en\r\nwrong,columns'
 page.locator('input[type=file]').nth(0).set_input_files({'name':'custom.csv','mimeType':'text/csv','buffer':custom.encode()})
 page.get_by_label('text *（必填）').select_option('body');page.get_by_role('button',name='确认追加导入').click()
 assert '2 条错误' in page.locator('.notice').inner_text()
 page.locator('nav button').nth(1).click();assert page.locator('.stats').inner_text().count('2')>=1
 page.get_by_role('button',name='not sticky',exact=True).click();assert page.locator('.evidence-item').count()==1;assert page.locator('.origin').count()==2
 assert page.locator('.origin a').count()==1
 page.get_by_role('button',name='关闭证据').click()
 page.locator('nav button').nth(3).click();page.get_by_role('button',name='创建人工草稿').click()
 assert '人工编辑' in page.locator('.story-card').inner_text()
 page.get_by_label('切换项目').select_option(data['id']);page.locator('nav button').nth(1).click();assert '8' in page.locator('.stats').inner_text()
 page.locator('nav button').nth(0).click()
 page.locator('input[type=file]').nth(2).set_input_files(str(out/'project.json'))
 page.wait_for_timeout(700);assert 'JSON 校验成功' in page.locator('.notice').inner_text()
 assert page.locator('.project-select option').count()==4
 page.get_by_label('项目名称',exact=True).fill('<img src=x onerror=alert(1)>')
 page.wait_for_timeout(700);assert page.locator('.breadcrumbs img').count()==0
 page.locator('nav button').nth(3).click();assert '上游数据已变更' in page.locator('main').inner_text()
 page.set_viewport_size({'width':390,'height':844});page.locator('nav button').nth(0).click();page.screenshot(path=str(out/'mobile-setup.png'),full_page=True)
 for i in range(5):
  page.locator('nav button').nth(i).click();assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'overflow at {i}'
 assert not errors,errors
 print('PASS: full three-story demo, exact word evidence, focus propagation, sentence mapping, stale check, refresh, isolated projects, mapped multiline CSV, dedup provenance, safe links, four exports, JSON reimport, HTML escaping, upstream staleness, five mobile layouts; no page or console errors.')
 browser.close()
