"""Editable analysis-window title; run against the root HTTP server."""
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

FIXTURE = """() => {
 const rows=[];
 for(const [cluster,offset] of [['A',0],['B',10]])
  for(let i=1;i<=12;i++)rows.push([cluster,String(i+offset)]);
 const s=newSheet('Titolo analisi',['Cluster','Misura'],rows);
 s.columns[0].automatic=false;s.columns[0].kind='Nominal';
 project.sheets=[s];project.activeSheetId=s.id;delete project.analysisWindowTitle;
 computeAdd(s,'Descrittiva',1,0);
 s.analyses[0].plotOptions={histogram:true,groups:{ciMean:true,confidence:99}};
 dirty=false;render();
} """

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for route in ['/', '/StatisticaWeb/']:
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:8000' + route)
        page.evaluate(FIXTURE)
        title = page.locator('#analysis-window-name')
        window = page.locator('.analysis-section')

        def data_state():
            return page.evaluate("JSON.stringify(project.sheets.map(({columns,rows,filters,analyses,revision})=>({columns,rows,filters,analyses,revision})))")

        original = data_state()
        expect(title).to_have_value('Analisi')
        assert title.get_attribute('maxlength') == '120'
        title.click()
        assert title.evaluate('el=>el.selectionStart===0&&el.selectionEnd===el.value.length')
        page.keyboard.type('Controllo qualità')
        title.press('Enter')
        expect(title).to_have_value('Controllo qualità')
        assert page.evaluate('project.analysisWindowTitle') == 'Controllo qualità'
        assert page.evaluate('dirty')
        assert json.loads(page.evaluate("localStorage.getItem('statistica-web-autosave')"))['analysisWindowTitle'] == 'Controllo qualità'
        assert data_state() == original

        # A commit with no change and Escape must not mark a project dirty.
        page.evaluate('dirty=false')
        title.click()
        title.press('Enter')
        assert not page.evaluate('dirty')
        title.fill('Da annullare')
        title.press('Escape')
        expect(title).to_have_value('Controllo qualità')
        assert page.evaluate('project.analysisWindowTitle') == 'Controllo qualità'
        assert not page.evaluate('dirty')
        title.fill('  Rapporto   mensile  ')
        page.locator('.analysis-head .eyebrow').click()
        expect(title).to_have_value('Rapporto mensile')
        assert page.evaluate('project.analysisWindowTitle') == 'Rapporto mensile'
        title.fill('   ')
        title.press('Enter')
        expect(title).to_have_value('Analisi')

        # The editor is single-line literal text, including strings that resemble HTML.
        literal = '<img src=x onerror=alert(1)> & risultati'
        title.fill(literal)
        title.press('Enter')
        expect(title).to_have_value(literal)
        assert page.locator('.analysis-window-title img').count() == 0
        assert data_state() == original
        title.fill('R' * 120)
        title.press('Enter')
        assert len(page.evaluate('project.analysisWindowTitle')) == 120

        # Editing works in normal, minimized and maximized views without mode changes.
        page.click('#analysis-minimize')
        expect(window).to_have_attribute('data-window-mode', 'minimized')
        title.fill('Analisi ridotte')
        title.press('Enter')
        expect(title).to_have_value('Analisi ridotte')
        expect(window).to_have_attribute('data-window-mode', 'minimized')
        page.click('#analysis-minimize')
        page.click('#analysis-maximize')
        expect(window).to_have_attribute('data-window-mode', 'maximized')
        title.dblclick()
        expect(window).to_have_attribute('data-window-mode', 'maximized')
        title.fill('Analisi ingrandite')
        title.press('Enter')
        page.locator('.analysis-head .eyebrow').dblclick()
        expect(window).to_have_attribute('data-window-mode', 'normal')
        assert data_state() == original

        # The title belongs to the project, and survives renders and sheet switching.
        page.evaluate("const s=newSheet('Secondo foglio',['C1'],[['1']]);project.sheets.push(s);project.activeSheetId=s.id;render()")
        expect(title).to_have_value('Analisi ingrandite')
        page.evaluate('project.activeSheetId=project.sheets[0].id;render()')
        expect(title).to_have_value('Analisi ingrandite')
        page.reload()
        expect(title).to_have_value('Analisi ingrandite')
        expect(page.locator('[data-plot-option="histogram"]')).to_be_checked()
        expect(page.locator('[data-group-plot-option="ciMean"]')).to_be_checked()

        # Ctrl+S exports an unblurred edit too, then import restores it.
        page.evaluate('window.showSaveFilePicker=undefined')
        title.fill('Titolo da esportare')
        title.press('Control+s')
        expect(page.locator('#modal')).to_be_visible()
        page.fill('#export-project-name', 'Titolo finestra')
        with page.expect_download() as download_event:
            page.click('#modal button[value="ok"]')
        exported = Path(download_event.value.path()).read_bytes()
        saved = json.loads(exported)
        assert saved['analysisWindowTitle'] == 'Titolo da esportare'
        page.set_input_files('#project-file', {'name': 'Titolo finestra.statweb.json', 'mimeType': 'application/json', 'buffer': exported})
        expect(title).to_have_value('Titolo da esportare')

        # Projects made before this feature retain the default title.
        saved.pop('analysisWindowTitle', None)
        legacy = json.dumps(saved).encode()
        page.set_input_files('#project-file', {'name': 'Vecchio progetto.statweb.json', 'mimeType': 'application/json', 'buffer': legacy})
        expect(title).to_have_value('Analisi')
        assert not page.evaluate('dirty')
        assert not errors, errors
        print(route, 'PASS: direct title editing, commit/cancel/default, literal text, window modes, unchanged statistics, persistence/export/import and legacy project')
        context.close()
    browser.close()
