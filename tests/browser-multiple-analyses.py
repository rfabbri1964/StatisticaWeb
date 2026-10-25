"""Independent analysis result windows, with the root HTTP server running."""
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

FIXTURE = """() => {
 const rows=[];
 for(const [cluster,offset] of [['A',0],['B',10]])
  for(let i=1;i<=12;i++)rows.push([cluster,String(i+offset),String(3*i+offset)]);
 const s=newSheet('Analisi multiple',['Cluster','Misura 1','Misura 2'],rows);
 s.columns[0].automatic=false;s.columns[0].kind='Nominal';
 project.sheets=[s];project.activeSheetId=s.id;render();
 computeAdd(s,'Descrittiva',1,0);computeAdd(s,'Descrittiva',2,0);
 s.analyses[0].plotOptions={histogram:true,groups:{ciMean:true,ciMedian:true,ciSd:true,confidence:95}};
 s.analyses[1].plotOptions={histogram:false,groups:{ciMean:true,confidence:95}};
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
        ids = page.evaluate('sheet().analyses.map(a=>a.id)')
        windows = page.locator('.analysis-result-window')
        first = page.locator(f'.analysis-result-window[data-analysis-id="{ids[0]}"]')
        second = page.locator(f'.analysis-result-window[data-analysis-id="{ids[1]}"]')
        backdrop = page.locator('#table-window-backdrop')
        expect(windows).to_have_count(2)

        def button(window, action):
            return window.locator(f'[data-analysis-window-action="{action}"]')

        def title(window):
            return window.locator('.analysis-result-title')

        def mode(window, value):
            expect(window).to_have_attribute('data-window-mode', value)

        def statistical_state():
            return page.evaluate("JSON.stringify({sheets:project.sheets.map(s=>({...s,analyses:s.analyses.map(({windowOptions,...a})=>a)})),dirty})")

        def same_size(window, expected):
            box = window.bounding_box()
            assert abs(box['width'] - expected['width']) < 3, (box, expected)
            assert abs(box['height'] - expected['height']) < 3, (box, expected)

        # Arrange distinct analyses side by side, then resize only one real window.
        page.click('#analysis-maximize')
        page.click('#arrange-analysis-windows')
        mode(first, 'normal');mode(second, 'normal')
        a, b = first.bounding_box(), second.bounding_box()
        assert abs(a['y'] - b['y']) < 3, (a, b)
        assert a['x'] + a['width'] <= b['x'] + 3, (a, b)
        assert first.evaluate('el=>getComputedStyle(el).resize') == 'both'
        state = statistical_state()
        page.mouse.move(a['x'] + a['width'] - 3, a['y'] + a['height'] - 3)
        page.mouse.down()
        page.mouse.move(a['x'] + a['width'] - 73, a['y'] + a['height'] - 73, steps=10)
        page.mouse.up()
        resized = first.bounding_box()
        assert resized['width'] < a['width'] - 30 and resized['height'] < a['height'] - 30, (a, resized)
        same_size(second, b)
        button(first, 'minimize').click()
        mode(first, 'minimized');mode(second, 'normal')
        expect(first.locator('.analysis-result-content')).to_be_hidden()
        expect(second.locator('.analysis-result-content')).to_be_visible()
        button(first, 'minimize').click()
        mode(first, 'normal');same_size(first, resized)
        assert statistical_state() == state

        # Card maximization has its own backdrop and retains chart controls.
        page.evaluate("setAnalysisWindowMode('normal');setTableWindowMode('minimized')")
        button(first, 'maximize').click()
        mode(first, 'maximized');mode(second, 'normal')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode','minimized')
        page.evaluate('render()')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode','minimized')
        expect(backdrop).to_be_visible()
        assert page.evaluate("getComputedStyle(document.body).overflow") == 'hidden'
        maxbox = first.bounding_box()
        assert abs(maxbox['x'] - 12) < 3 and abs(maxbox['y'] - 12) < 3, maxbox
        assert statistical_state() == state
        first.locator('[data-plot-option="histogram"]').uncheck()
        expect(first.locator('[data-chart="histogram"]')).to_have_count(0)
        expect(second.locator('[data-plot-option="histogram"]')).not_to_be_checked()
        first.locator('.group-confidence-control input[type="number"]').fill('99')
        expect(first.locator('.group-confidence-control input[type="range"]')).to_have_value('99')
        expect(second.locator('.group-confidence-control input[type="number"]')).to_have_value('95')
        button(first, 'maximize').click()
        mode(first, 'normal')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode','minimized')
        page.evaluate("setTableWindowMode('normal')")
        expect(backdrop).to_be_hidden()
        same_size(first, resized)
        assert page.evaluate("getComputedStyle(document.body).overflow") != 'hidden'

        # Result names are independent metadata, and do not defeat deduplication.
        old_second = title(second).input_value()
        before_title_key = page.evaluate('analysisResultKey(sheet().analyses[0])')
        title(first).fill('Rapporto reparto A');title(first).press('Enter')
        expect(title(second)).to_have_value(old_second)
        assert page.evaluate('sheet().analyses[0].windowOptions.title') == 'Rapporto reparto A'
        assert page.evaluate('analysisResultKey(sheet().analyses[0])') == before_title_key
        title(first).fill('Annullato');title(first).press('Escape')
        expect(title(first)).to_have_value('Rapporto reparto A')
        title(second).fill('Rapporto reparto B')
        second.locator('.analysis-card-head').click(position={'x': 4, 'y': 4})
        expect(title(second)).to_have_value('Rapporto reparto B')
        button(first, 'minimize').click()
        page.evaluate("computeAdd(sheet(),'Descrittiva',1,0)")
        expect(windows).to_have_count(2)
        mode(first, 'normal')
        expect(title(first)).to_have_value('Rapporto reparto A')
        expect(first.locator('.group-confidence-control input[type="number"]')).to_have_value('99')

        # View state survives re-rendering, while refresh preserves metadata/options.
        button(first, 'minimize').click()
        page.evaluate('render()')
        mode(first, 'minimized');mode(second, 'normal')
        button(first, 'minimize').click()
        same_size(first, resized)
        page.evaluate("sheet().rows[0][1]='35';touch()")
        first.locator('[data-refresh-analysis]').click()
        expect(windows).to_have_count(2)
        expect(title(first)).to_have_value('Rapporto reparto A')
        expect(title(second)).to_have_value('Rapporto reparto B')
        expect(first.locator('.group-confidence-control input[type="number"]')).to_have_value('99')
        mode(first, 'normal');same_size(first, resized)

        # Ctrl+S exports a focused draft and round-trips both result titles.
        page.evaluate('window.showSaveFilePicker=undefined')
        title(first).fill('Finestra esportata')
        title(first).press('Control+s')
        expect(page.locator('#modal')).to_be_visible()
        page.fill('#export-project-name', 'Finestre analisi')
        with page.expect_download() as download_event:
            page.click('#modal button[value="ok"]')
        exported = Path(download_event.value.path()).read_bytes()
        saved = json.loads(exported)
        assert saved['sheets'][0]['analyses'][0]['windowOptions']['title'] == 'Finestra esportata'
        assert saved['sheets'][0]['analyses'][1]['windowOptions']['title'] == 'Rapporto reparto B'
        page.reload()
        expect(windows).to_have_count(2)
        expect(title(first)).to_have_value('Finestra esportata')
        page.set_input_files('#project-file', {'name': 'Finestre.statweb.json', 'mimeType': 'application/json', 'buffer': exported})
        expect(windows).to_have_count(2)
        expect(title(first)).to_have_value('Finestra esportata')
        expect(title(second)).to_have_value('Rapporto reparto B')

        # Removing a maximized result cleans up the overlay and reindexes controls.
        page.evaluate("setAnalysisWindowMode('normal')")
        button(first, 'maximize').click()
        first.locator('[data-remove-analysis]').click()
        expect(windows).to_have_count(1)
        expect(backdrop).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow") != 'hidden'
        expect(title(second)).to_have_value('Rapporto reparto B')
        expect(button(second, 'minimize')).to_have_attribute('data-analysis-index', '0')
        button(second, 'minimize').click();mode(second, 'minimized')
        button(second, 'minimize').click();mode(second, 'normal')
        title(second).fill('Indice aggiornato');title(second).press('Enter')
        assert page.evaluate('sheet().analyses[0].windowOptions.title') == 'Indice aggiornato'

        # Switching away from a maximized result never leaves the page locked.
        button(second, 'maximize').click()
        page.evaluate("const s=newSheet('Vuoto',['C1'],[['1']]);project.sheets.push(s);project.activeSheetId=s.id;render()")
        expect(windows).to_have_count(0)
        expect(backdrop).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow") != 'hidden'
        assert not errors, errors
        print(route, 'PASS: separate windows, tiling/resize, independent modes/titles/charts, dedup reveal, refresh, persistence/export/import and cleanup')
        context.close()
    browser.close()
