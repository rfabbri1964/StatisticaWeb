"""Cluster charts: run against the root HTTP server with isolated browser data."""
import json
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright


FIXTURE = """() => {
 const rows=[];
 for(const [cluster,offset] of [['A',0],['B',10],['<img src=x onerror=alert(1)>',20]])
  for(const v of [1,2,3,4,5,7])rows.push([cluster,String(v+offset)]);
 const s=newSheet('Cluster test',['Cluster','Misura'],rows);
 s.columns[0].automatic=false;s.columns[0].kind='Nominal';
 project.sheets=[s];project.activeSheetId=s.id;dirty=true;render();
 computeAdd(s,'Descrittiva',1,0);
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
        plots = page.locator('.group-analysis-plots')
        expect(plots).to_have_count(1)
        expect(plots.locator('svg')).to_have_count(0)
        revision = page.evaluate('sheet().revision')
        rows = page.evaluate('JSON.stringify(sheet().rows)')

        def option(name):
            return page.locator(f'[data-group-plot-option="{name}"]')

        def menu():
            details = page.locator('.group-results details').first
            if details.get_attribute('open') is None:
                details.locator('summary').click()
            return details

        def choose_all(value):
            menu().locator(f'[data-group-select="{value}"]').click()

        def cluster_checkbox(label):
            return menu().get_by_role('checkbox', name=re.compile('^' + re.escape(label) + r' · N = '))

        # Both independent checkboxes affect only plots below the cluster table.
        option('histogram').check()
        expect(plots.locator('.stat-plot')).to_have_count(3)
        option('normality').check()
        expect(plots.locator('.stat-plot')).to_have_count(6)
        expect(page.locator('.general-analysis [data-chart]')).to_have_count(0)
        page.locator('[data-plot-option="histogram"]').check()
        expect(page.locator('.general-analysis [data-chart="histogram"]')).to_have_count(1)
        assert page.evaluate('sheet().revision') == revision
        assert page.evaluate('JSON.stringify(sheet().rows)') == rows
        assert page.locator('.group-results img').count() == 0

        # No selection is explicit; reselect one cluster without changing the analysis.
        choose_all('none')
        expect(plots.locator('svg')).to_have_count(0)
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).selected') == []
        cluster_checkbox('B').check()
        expect(plots.locator('.stat-plot')).to_have_count(2)
        key_b = page.evaluate("AnalysisPlots.groupKey(sheet().analyses[0].groups.find(g=>g.category==='B'))")
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).selected') == [key_b]
        choose_all('all')
        option('overlay').check()
        expect(plots.locator('.stat-plot')).to_have_count(2)
        # Overlay is one chart per type, keeping the overall chart independent.
        expect(plots.locator('svg')).to_have_count(2)
        expect(page.locator('.general-analysis [data-chart="histogram"]')).to_have_count(1)
        page.reload()
        expect(option('histogram')).to_be_checked()
        expect(option('normality')).to_be_checked()
        expect(option('overlay')).to_be_checked()
        expect(plots.locator('.stat-plot')).to_have_count(2)

        # Changing graphic controls never creates duplicate analyses on repeat calculation.
        page.evaluate("computeAdd(sheet(),'Descrittiva',1,0)")
        expect(page.locator('.analysis-card')).to_have_count(1)
        expect(option('overlay')).to_be_checked()
        choose_all('none')
        cluster_checkbox('B').check()
        # Export via the real fallback download, then re-open through the file input.
        page.evaluate('window.showSaveFilePicker=undefined')
        page.click('#save-project')
        page.fill('#export-project-name', 'Cluster selezionati')
        with page.expect_download() as download_event:
            page.click('#modal button[value="ok"]')
        exported = Path(download_event.value.path()).read_bytes()
        saved = json.loads(exported)
        assert saved['sheets'][0]['analyses'][0]['plotOptions']['groups']['selected'] == [key_b]
        page.set_input_files('#project-file', {'name': 'Cluster selezionati.statweb.json', 'mimeType': 'application/json', 'buffer': exported})
        expect(option('overlay')).to_be_checked()
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).selected') == [key_b]

        # Reordered cluster results and inserted/removed categories retain identity by key.
        page.evaluate("""const s=sheet();s.columns[0].kind='Ordinal';s.columns[0].levels=['B','A'];
         s.rows=s.rows.filter(r=>r[0]==='A'||r[0]==='B');s.rows.push(['Nuovo','42']);touch(s)""")
        page.locator('[data-refresh-analysis]').click()
        expect(page.locator('.analysis-card')).to_have_count(1)
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).selected') == [key_b]
        assert page.evaluate("sheet().analyses[0].groups[0].category") == 'Nuovo' or page.evaluate("sheet().analyses[0].groups[0].category") == 'B'
        expect(plots.locator('.stat-plot')).to_have_count(2)
        assert page.locator('[data-refresh-analysis]').count() == 0

        # No-valid-data, one/two-point, constant, and literal/missing categories are safe.
        page.evaluate("""const s=sheet();s.columns[0].kind='Nominal';s.rows=[['Vuoto','*'],['Uno','1'],['Due','1'],['Due','2'],['Costante','5'],['Costante','5'],['Costante','5'],['(mancante)','3'],['','4']];touch(s);refreshAnalysis(0)""")
        choose_all('all')
        expect(menu().get_by_role('checkbox', name=re.compile(r'^\(mancante · valore assente\) · N = '))).to_have_count(1)
        expect(menu().get_by_role('checkbox', name=re.compile(r'^\(mancante\) · N = '))).to_have_count(1)
        option('overlay').uncheck()
        assert 'Servono almeno 3' in plots.inner_text() or 'almeno 3' in plots.inner_text()
        assert 'uguali' in plots.inner_text() or 'costanti' in plots.inner_text()
        assert page.evaluate("new Set(sheet().analyses[0].groups.map(AnalysisPlots.groupKey)).size") == 6
        option('overlay').check()
        invalid = plots.locator('svg').evaluate_all("els=>els.some(el=>/NaN|Infinity/.test(el.outerHTML))")
        assert not invalid
        assert not errors, errors
        print(route, 'PASS: cluster checkboxes, dropdown selection, separate/overlay, persistence/export/import, dedup, stable cluster keys, edge samples and escaping')
        context.close()
    browser.close()
