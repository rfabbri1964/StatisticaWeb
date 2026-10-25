"""Left navigation of analysis windows across project sheets; root server required."""
import json
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

FIXTURE = """() => {
 const rows=[];
 for(const [cluster,offset] of [['A',0],['B',10]])
  for(let i=1;i<=12;i++)rows.push([cluster,String(i+offset),String(i*3+offset)]);
 const a=newSheet('Primo foglio',['Cluster','Misura 1','Misura 2'],rows);
 const b=newSheet('Secondo foglio',['Cluster','Misura 1','Misura 2'],rows);
 for(const s of [a,b]){s.columns[0].automatic=false;s.columns[0].kind='Nominal'}
 project.sheets=[a,b];project.activeSheetId=a.id;render();
 computeAdd(a,'Descrittiva',1,0);computeAdd(a,'Descrittiva',2,0);
 a.analyses[0].windowOptions={title:'Confronto'};
 a.analyses[0].plotOptions={histogram:true,groups:{ciMean:true,confidence:99}};
 project.activeSheetId=b.id;render();computeAdd(b,'Descrittiva',1,0);
 b.analyses[0].windowOptions={title:'Confronto'};
 project.activeSheetId=a.id;dirty=false;render();
 return {firstSheet:a.id,secondSheet:b.id,first:a.analyses[0].id,second:a.analyses[1].id,third:b.analyses[0].id};
} """

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for route in ['/', '/StatisticaWeb/']:
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://127.0.0.1:8000'+route)
        nav=page.locator('#analysis-navigation')
        expect(nav.locator('[data-open-analysis]')).to_have_count(0)
        expect(nav.locator('.analysis-nav-empty')).to_be_visible()
        ids=page.evaluate(FIXTURE)

        def entry(name):
            return nav.locator(f'[data-open-analysis="{ids[name]}"]')

        def window(name):
            return page.locator(f'.analysis-result-window[data-analysis-id="{ids[name]}"]')

        def activate(name,script=False):
            if script:entry(name).evaluate('el=>el.click()')
            else:entry(name).click()
            expect(entry(name)).to_have_attribute('aria-current','true')
            expect(entry(name)).to_have_class(re.compile(r'\bactive\b'))
            expect(window(name)).to_be_focused()

        def statistical_state():
            return page.evaluate("JSON.stringify({sheets:project.sheets.map(({selectedAnalysis,...s})=>s),dirty})")

        expect(nav.locator('[data-open-analysis]')).to_have_count(3)
        expect(entry('first').locator('.analysis-nav-title')).to_have_text('Confronto')
        expect(entry('third').locator('.analysis-nav-title')).to_have_text('Confronto')
        expect(entry('first').locator('.analysis-nav-sheet')).to_have_text('Primo foglio')
        expect(entry('third').locator('.analysis-nav-sheet')).to_have_text('Secondo foglio')
        before=statistical_state()
        activate('first');activate('second');activate('first')
        assert statistical_state()==before
        expect(page.locator('.analysis-result-window')).to_have_count(2)
        # A result and its parent can both be reduced, then restored from one entry.
        window('first').locator('[data-analysis-window-action="minimize"]').click()
        page.click('#analysis-minimize')
        activate('first')
        expect(window('first')).not_to_have_attribute('data-window-mode','minimized')
        expect(page.locator('.analysis-section')).not_to_have_attribute('data-window-mode','minimized')
        expect(window('first').locator('[data-plot-option="histogram"]')).to_be_checked()
        expect(window('first').locator('.group-confidence-control input[type="number"]')).to_have_value('99')
        assert statistical_state()==before
        # Focusing another window updates its navigation entry without recalculation.
        window('second').locator('.analysis-result-title').click()
        expect(entry('second')).to_have_attribute('aria-current','true')
        window('second').locator('.analysis-result-title').press('Escape')
        assert statistical_state()==before
        # Navigation switches the owning sheet and clears a different fullscreen view.
        window('first').locator('[data-analysis-window-action="maximize"]').click()
        activate('third',script=True)
        assert page.evaluate('project.activeSheetId')==ids['secondSheet']
        expect(page.locator('#table-window-backdrop')).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow")!='hidden'
        assert statistical_state()==before
        activate('first')
        assert page.evaluate('project.activeSheetId')==ids['firstSheet']
        # A remembered maximized card may reopen; return to normal for visible sidebar actions.
        if window('first').get_attribute('data-window-mode')=='maximized':
            window('first').locator('[data-analysis-window-action="maximize"]').click()
        page.locator(f'#sheet-list [data-sheet="{ids["secondSheet"]}"]').click()
        expect(nav.locator('[data-open-analysis]')).to_have_count(3)
        activate('first')
        if window('first').get_attribute('data-window-mode')=='maximized':
            window('first').locator('[data-analysis-window-action="maximize"]').click()
        # Confirmed names update the list; cancelled edits and literal markup are safe.
        title=window('first').locator('.analysis-result-title')
        title.fill('  Rapporto   qualità  ');title.press('Enter')
        expect(entry('first').locator('.analysis-nav-title')).to_have_text('Rapporto qualità')
        title.fill('Non confermato');title.press('Escape')
        expect(entry('first').locator('.analysis-nav-title')).to_have_text('Rapporto qualità')
        title.fill('<img src=x onerror=alert(1)>');title.press('Enter')
        expect(entry('first').locator('.analysis-nav-title')).to_have_text('<img src=x onerror=alert(1)>')
        assert nav.locator('img').count()==0
        # Clicking another entry must commit the focused draft without replacing the target.
        title.fill('Titolo confermato dal cambio finestra')
        activate('second')
        expect(entry('first').locator('.analysis-nav-title')).to_have_text('Titolo confermato dal cambio finestra')
        activate('first')
        # Removal uses identity, so surviving entries still open the correct shifted index.
        window('first').locator('[data-remove-analysis]').click()
        expect(entry('first')).to_have_count(0)
        expect(nav.locator('[data-open-analysis]')).to_have_count(2)
        activate('second')
        title=window('second').locator('.analysis-result-title')
        title.fill('Titolo sopravvissuto');title.press('Enter')
        expect(entry('second').locator('.analysis-nav-title')).to_have_text('Titolo sopravvissuto')
        # Export/import and reload reconstruct the project-wide list from saved results.
        page.evaluate('window.showSaveFilePicker=undefined')
        page.click('#save-project');page.fill('#export-project-name','Navigazione analisi')
        with page.expect_download() as exported_event:page.click('#modal button[value="ok"]')
        exported=Path(exported_event.value.path()).read_bytes()
        assert len(json.loads(exported)['sheets'])==2
        page.set_input_files('#project-file',{'name':'Navigazione analisi.statweb.json','mimeType':'application/json','buffer':exported})
        expect(nav.locator('[data-open-analysis]')).to_have_count(2)
        expect(entry('second').locator('.analysis-nav-title')).to_have_text('Titolo sopravvissuto')
        page.reload()
        expect(nav.locator('[data-open-analysis]')).to_have_count(2)
        activate('third')
        expect(entry('third').locator('.analysis-nav-sheet')).to_have_text('Secondo foglio')
        # A long list scrolls without pushing data commands or the page sideways.
        page.evaluate("""const s=sheet(),base=s.analyses[0];
         for(let i=0;i<12;i++){const a=clone(base);a.id=uid();a.windowOptions={title:'Titolo molto lungo '+i+' '+('categoria '.repeat(12))};a.filter='Selezione distinta '+i;s.analyses.push(a)}render()""")
        expect(nav.locator('[data-open-analysis]')).to_have_count(14)
        assert nav.evaluate('el=>el.scrollWidth<=el.clientWidth+2')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
        page.locator('#import-csv').scroll_into_view_if_needed()
        expect(page.locator('#import-csv')).to_be_visible()
        # New project replaces the list instead of leaving stale pages behind.
        page.evaluate('dirty=false')
        page.click('#new-project')
        expect(nav.locator('[data-open-analysis]')).to_have_count(0)
        expect(nav.locator('.analysis-nav-empty')).to_be_visible()
        assert not errors,errors
        print(route,'PASS: project-wide analysis list, titles, activation/restoration, stable identities, deletion, persistence, long-list layout and project reset')
        context.close()
    browser.close()
