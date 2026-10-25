import json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for route in ['/','/StatisticaWeb/']:
  ctx=b.new_context(accept_downloads=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000'+route)
  page.evaluate("window.showSaveFilePicker=undefined;dirty=true")
  page.click('#save-project');page.fill('#export-project-name','Prova reparto');
  with page.expect_download() as info:page.click('#modal button[value=ok]')
  dl=info.value;assert dl.suggested_filename=='Prova reparto.statweb.json'
  data=json.loads(open(dl.path()).read());assert data['name']=='Prova reparto';assert len(data['sheets'][0]['rows'])==10
  page.evaluate('dirty=true');page.click('#save-project');page.click('#modal button[value=cancel]');assert page.evaluate('dirty')
  page.evaluate("""window.showSaveFilePicker=async options=>{window.options=options;return {name:'Scelto.statweb.json',createWritable:async()=>({write:async text=>window.written=text,close:async()=>window.saveClosed=true})}}""")
  page.click('#save-project');page.wait_for_function('window.saveClosed===true');assert page.evaluate('options.suggestedName')=='Prova reparto.statweb.json';assert json.loads(page.evaluate('written'))['name']=='Scelto';assert not page.evaluate('dirty')
  page.evaluate("dirty=true;window.showSaveFilePicker=async()=>{throw new DOMException('Annullato','AbortError')};void 0");page.click('#save-project');page.wait_for_function('!projectExportPending');assert page.evaluate('dirty')
  page.on('dialog',lambda d:d.accept());page.evaluate("window.showSaveFilePicker=async()=>({name:'Errore.statweb.json',createWritable:async()=>({write:async()=>{throw Error('Disco pieno')},abort:async()=>window.aborted=true})})");page.click('#save-project');page.wait_for_function('window.aborted===true');assert page.evaluate('dirty');assert page.evaluate('project.name')=='Scelto'
  page.evaluate("window.showSaveFilePicker=async()=>{window.calls=(window.calls||0)+1;return await new Promise(resolve=>window.finishPicker=resolve)};void 0")
  page.keyboard.press('Control+s');page.wait_for_function('!!window.finishPicker');page.keyboard.press('Control+s');assert page.evaluate('window.calls')==1
  page.evaluate("sheet().rows[0][2]='99';dirty=true;window.finishPicker({name:'Prima.statweb.json',createWritable:async()=>({write:async t=>window.savedBeforeEdit=t,close:async()=>{}})})")
  page.wait_for_function('!projectExportPending');assert page.evaluate('dirty');assert page.evaluate('sheet().rows[0][2]')=='99';assert json.loads(page.evaluate('savedBeforeEdit'))['sheets'][0]['rows'][0][2]!='99'
  assert not errors,errors
  print(route,'PASS: filename/download contents, native picker contract, cancel, write error, Ctrl+S, concurrent save and pending edits');ctx.close()
 b.close()
