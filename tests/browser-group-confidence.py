"""Grouped CIs: one comparison chart per parameter, using isolated browser contexts."""
import json
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

FIXTURE = """() => {
 const rows=[];
 for(const [cluster,offset,scale] of [['A',0,1],['B',20,2]])
  for(const value of [1,2,3,4,5,7,8,9,11,12,14,16])rows.push([cluster,String(offset+scale*value)]);
 const s=newSheet('IC cluster',['Cluster','Misura'],rows);
 s.columns[0].automatic=false;s.columns[0].kind='Nominal';
 project.sheets=[s];project.activeSheetId=s.id;dirty=true;render();computeAdd(s,'Descrittiva',1,0);
} """
CHARTS = [('ciMean', 'group-ci-mean'), ('ciMedian', 'group-ci-median'), ('ciSd', 'group-ci-sd')]

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
        number = page.locator('.group-confidence-control input[type="number"]')
        slider = page.locator('.group-confidence-control input[type="range"]')
        revision = page.evaluate('sheet().revision')
        rows_before = page.evaluate('JSON.stringify(sheet().rows)')

        def option(name):
            return page.locator(f'[data-group-plot-option="{name}"]')

        def menu():
            details = page.locator('.group-results details')
            if details.get_attribute('open') is None:
                details.locator('summary').click()
            return details

        def choose_all(value):
            menu().locator(f'[data-group-select="{value}"]').click()

        def ci_chart(name):
            return plots.locator(f'[data-chart="{name}"]')

        def widths():
            return page.evaluate("AnalysisPlots.groupConfidenceIntervals(sheet().analyses[0]).map(g=>g.intervals.map(i=>i.high-i.low))")

        expect(number).to_be_hidden()
        # Each checkbox independently activates exactly one comparison, with both clusters.
        for control, chart in CHARTS:
            option(control).check()
            expect(plots.locator('[data-chart]')).to_have_count(1)
            expect(ci_chart(chart).locator('.group-ci-values tbody tr')).to_have_count(2)
            expect(ci_chart(chart).locator('svg')).to_have_count(1)
            expect(number).to_have_value('95')
            option(control).uncheck()
            expect(plots.locator('[data-chart]')).to_have_count(0)
            expect(number).to_be_hidden()
        for control, _ in CHARTS:
            option(control).check()
        expect(plots.locator('[data-chart]')).to_have_count(3)
        initial_widths = widths()
        mean_rows = ci_chart('group-ci-mean').locator('.group-ci-values tbody tr')
        assert mean_rows.nth(0).locator('[data-ci-estimate]').inner_text() != mean_rows.nth(1).locator('[data-ci-estimate]').inner_text()

        # Group confidence is independent of the overall-data IC controls.
        page.locator('[data-plot-option="intervals"]').check()
        overall_number = page.locator('.general-analysis input[type="number"][data-plot-option="confidence"]')
        expect(overall_number).to_have_value('95')
        number.fill('99')
        expect(slider).to_have_value('99')
        expect(overall_number).to_have_value('95')
        for previous_group, current_group in zip(initial_widths, widths()):
            for previous, current in zip(previous_group, current_group):
                assert current > previous, (previous, current)
        assert page.evaluate('sheet().revision') == revision
        assert page.evaluate('JSON.stringify(sheet().rows)') == rows_before
        # Invalid/partial edits leave the saved confidence and chart bounds untouched.
        saved_widths = widths()
        number.fill('')
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).confidence') == 99
        assert widths() == saved_widths
        number.fill('100')
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).confidence') == 99
        number.fill('99.9')
        expect(slider).to_have_value('99.9')
        slider.fill('50')
        expect(number).to_have_value('50')
        slider.fill('90')
        expect(number).to_have_value('90')

        # Overlay mode never splits the three cluster CI comparisons.
        for checked in [True, False]:
            option('overlay').set_checked(checked)
            expect(plots.locator('[data-chart]')).to_have_count(3)
            for _, chart in CHARTS:
                expect(ci_chart(chart)).to_have_count(1)
                expect(ci_chart(chart).locator('.group-ci-values tbody tr')).to_have_count(2)
        choose_all('none')
        expect(plots.locator('[data-chart]')).to_have_count(0)
        menu().get_by_role('checkbox', name=re.compile(r'^B · N = ')).check()
        for _, chart in CHARTS:
            expect(ci_chart(chart).locator('.group-ci-values tbody tr')).to_have_count(1)
            expect(ci_chart(chart).locator('.group-ci-values tbody tr')).to_contain_text('B')
        key_b = page.evaluate("AnalysisPlots.groupKey(sheet().analyses[0].groups.find(g=>g.category==='B'))")
        page.reload()
        for control, chart in CHARTS:
            expect(option(control)).to_be_checked()
            expect(ci_chart(chart).locator('.group-ci-values tbody tr')).to_have_count(1)
        expect(number).to_have_value('90')
        expect(overall_number).to_have_value('95')

        # Repeating the calculation keeps graph settings without a duplicate analysis.
        page.evaluate("computeAdd(sheet(),'Descrittiva',1,0)")
        expect(page.locator('.analysis-card')).to_have_count(1)
        expect(number).to_have_value('90')
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).selected') == [key_b]
        # Export/import must carry both CI flags, confidence, and selected cluster.
        page.evaluate('window.showSaveFilePicker=undefined')
        page.click('#save-project')
        page.fill('#export-project-name', 'Confronto IC cluster')
        with page.expect_download() as download_event:
            page.click('#modal button[value="ok"]')
        exported = Path(download_event.value.path()).read_bytes()
        saved_options = json.loads(exported)['sheets'][0]['analyses'][0]['plotOptions']
        for control, _ in CHARTS:
            assert saved_options['groups'][control]
        assert saved_options['groups']['confidence'] == 90
        assert saved_options['groups']['selected'] == [key_b]
        assert saved_options['intervals']
        page.set_input_files('#project-file', {'name': 'Confronto IC cluster.statweb.json', 'mimeType': 'application/json', 'buffer': exported})
        expect(number).to_have_value('90')
        for control, _ in CHARTS:
            expect(option(control)).to_be_checked()
        page.evaluate("sheet().rows[12][1]='23';touch()")
        page.locator('[data-refresh-analysis]').click()
        expect(page.locator('.analysis-card')).to_have_count(1)
        expect(number).to_have_value('90')
        assert page.evaluate('AnalysisPlots.groupOptions(sheet().analyses[0]).selected') == [key_b]
        for _, chart in CHARTS:
            expect(ci_chart(chart).locator('.group-ci-values tbody tr')).to_have_count(1)

        # Insufficient data and nonfinite exact median CIs remain explicit and safe.
        page.evaluate("""const s=sheet();s.rows=[['Vuoto','*'],['Uno','1'],['Due','1'],['Due','2'],['Costante','5'],['Costante','5'],['Costante','5']];touch(s);refreshAnalysis(0)""")
        choose_all('all')
        number.fill('95')
        for _, chart in CHARTS:
            expect(ci_chart(chart)).to_have_count(1)
            expect(ci_chart(chart).locator('.group-ci-values tbody tr')).to_have_count(4)
        text = plots.inner_text()
        assert 'Servono almeno 2' in text or 'almeno 2 valori' in text
        assert '∞' in ci_chart('group-ci-median').inner_text()
        assert not plots.locator('svg').evaluate_all("els=>els.some(el=>/NaN|Infinity/.test(el.outerHTML))")
        assert not errors, errors
        print(route, 'PASS: independent cluster CIs, common comparison per parameter, confidence validation/sync, selection, persistence/export/import, recalculation/dedup and edge samples')
        context.close()
    browser.close()
