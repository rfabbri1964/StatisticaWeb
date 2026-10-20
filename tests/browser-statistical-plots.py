from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for route in ['/', '/StatisticaWeb/']:
  ctx=b.new_context(viewport={'width':1440,'height':1000});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000'+route)
  def run(group='1'):
   page.click('#run-descriptive');page.select_option('#descriptive-column','2');page.select_option('#group-select',group);page.click('#modal button[value="ok"]');page.wait_for_timeout(100)
  run();assert page.locator('[data-chart]').count()==0
  for name in ['histogram','normality','intervals']:page.locator(f'[data-plot-option="{name}"]').check()
  assert page.locator('[data-chart]').count()==3
  assert page.locator('.normality-band').count()==1
  assert page.locator('.normality-point').count()==10
  assert '0,8902044' in page.locator('.normality-test').inner_text()
  assert page.locator('.ci-parameter').count()==3
  assert page.locator('.group-table').count()==1
  before=page.locator('.ci-parameter').first.inner_text()
  number=page.locator('input[type="number"][data-plot-option="confidence"]');number.fill('99')
  assert page.locator('.ci-parameter').first.inner_text()!=before
  assert page.locator('[data-chart="intervals"] h4').inner_text().endswith('99%')
  assert page.locator('input[type="range"]').input_value()=='99'
  page.locator('input[type="range"]').fill('90');assert number.input_value()=='90'
  page.reload();assert page.locator('[data-chart]').count()==3;assert number.input_value()=='90'
  run();assert page.locator('.analysis-card').count()==1;assert page.locator('[data-chart]').count()==3
  page.evaluate("sheet().rows[0][2]='21';touch()");page.locator('[data-refresh-analysis]').click();assert page.locator('[data-chart]').count()==3
  page.locator('[data-plot-option="histogram"]').uncheck();assert page.locator('[data-chart="histogram"]').count()==0;assert page.locator('[data-chart]').count()==2
  page.locator('[data-plot-option="intervals"]').uncheck();assert page.locator('.confidence-control').is_hidden()
  # A second analysis without grouping has its own controls and confidence level.
  run('-1');assert page.locator('.analysis-card').count()==2
  second=page.locator('.analysis-card').nth(1);second.locator('[data-plot-option="normality"]').check();assert second.locator('.normality-point').count()==10
  # Small/constant samples display the limitation instead of broken graphs.
  page.evaluate("const s=sheet();s.rows=[['1','M1','5']];classify(s);s.analyses=[calc(s,'Descrittiva',2,-1)];s.analyses[0].plotOptions={histogram:true,normality:true,intervals:true,confidence:95};render()")
  assert 'almeno 3 valori' in page.locator('[data-chart="normality"]').inner_text()
  assert 'Campione insufficiente' in page.locator('[data-chart="intervals"]').inner_text()
  assert page.locator('.histogram-bin').count()==1
  assert not errors,errors
  print(route,'PASS: independent checkboxes, all graphs, AD/band, dynamic confidence, persistence, dedup, recalculation, grouped/ungrouped, small samples');ctx.close()
 b.close()
