from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for route in ['/','/StatisticaWeb/']:
  ctx=b.new_context();page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8000'+route)
  page.evaluate("""project.sheets=[newSheet('Test',['Data','Categoria','Numero'],[['31/12/2025','A','1'],['01/01/2026','B','2'],['2026-01-02','A','3'],['03/01/2026','C','4'],['','', '5']])];project.activeSheetId=project.sheets[0].id;render()""")
  assert page.evaluate('sheet().columns[0].kind')=='Date'
  assert page.evaluate("calendarDate('31/02/2026')") is None
  page.click('#filter-toggle');page.select_option('#filter-column','0')
  assert page.locator('#filter-value').get_attribute('type')=='date'
  page.select_option('#filter-op','tra');page.fill('#filter-value','2026-01-01');page.fill('#filter-end','2026-01-02');page.click('#apply-filter')
  expect(page.locator('#visible-count')).to_have_text('2 di 5')
  page.select_option('#filter-column','1');page.click('#filter-editor [data-all="false"]');page.locator('#filter-editor').get_by_role('checkbox',name='A',exact=True).check();page.locator('#filter-editor').get_by_role('checkbox',name='C',exact=True).check();page.click('#apply-filter')
  expect(page.locator('#visible-count')).to_have_text('1 di 5')
  page.reload();expect(page.locator('#visible-count')).to_have_text('1 di 5')
  page.click('#clear-filters');expect(page.locator('#visible-count')).to_have_text('5 di 5')
  page.evaluate('void filterTableColumn(sheet(),1)');assert page.locator('#column-filter-editor input[type=checkbox]').count()==4
  page.click('#column-filter-editor [data-all="false"]');page.on('dialog',lambda d:d.accept());page.click('#modal button[value=ok]');assert page.locator('#modal').is_visible()
  page.locator('#column-filter-editor').get_by_role('checkbox',name='B',exact=True).check();page.click('#modal button[value=ok]');expect(page.locator('#visible-count')).to_have_text('1 di 5')
  page.click('#clear-filters');page.evaluate('void filterTableColumn(sheet(),0)');page.select_option('#column-filter-op','≥');page.fill('#column-filter-value','2026-01-02');page.click('#modal button[value=ok]');expect(page.locator('#visible-count')).to_have_text('2 di 5')
  page.click('#clear-filters');page.evaluate('void filterTableColumn(sheet(),2)');page.select_option('#column-filter-op','>');page.fill('#column-filter-value','3');page.click('#modal button[value=ok]');expect(page.locator('#visible-count')).to_have_text('2 di 5')
  assert not errors,errors
  print(route,'PASS date ranges, Italian/ISO dates, checkboxes, AND, persistence, modal validation, numeric filters');ctx.close()
 b.close()
