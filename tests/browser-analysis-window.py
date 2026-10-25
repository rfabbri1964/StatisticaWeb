"""Analysis window geometry and controls; run with the root HTTP server active."""
import re
from playwright.sync_api import expect, sync_playwright

FIXTURE = """() => {
 const rows=[];
 for(const [cluster,offset] of [['A',0],['B',10]])
  for(let i=1;i<=12;i++)rows.push([cluster,String(i+offset)]);
 const s=newSheet('Finestra analisi',['Cluster','Misura'],rows);
 s.columns[0].automatic=false;s.columns[0].kind='Nominal';
 project.sheets=[s];project.activeSheetId=s.id;dirty=true;render();
 computeAdd(s,'Descrittiva',1,0);
 s.analyses[0].plotOptions={histogram:true,groups:{ciMean:true,ciMedian:true,ciSd:true,confidence:95}};
 render();
} """

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for route in ['/', '/StatisticaWeb/']:
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:8000' + route)
        page.evaluate(FIXTURE)
        section = page.locator('.analysis-section')
        content = page.locator('.analysis-window-body')
        title = section.locator('.analysis-head .eyebrow')
        minimize = page.locator('#analysis-minimize')
        maximize = page.locator('#analysis-maximize')
        backdrop = page.locator('#table-window-backdrop')

        def mode(value):
            expect(section).to_have_attribute('data-window-mode', value)

        def state():
            return page.evaluate("JSON.stringify({project,dirty})")

        def box_close(expected):
            actual = section.bounding_box()
            assert abs(actual['width'] - expected['width']) < 2, (actual, expected)
            assert abs(actual['height'] - expected['height']) < 2, (actual, expected)

        mode('normal')
        assert section.evaluate("el=>getComputedStyle(el).resize") == 'both'
        section.scroll_into_view_if_needed()
        before_resize = section.bounding_box()
        # Exercise the browser's actual bottom-right resize handle.
        page.mouse.move(before_resize['x'] + before_resize['width'] - 3, before_resize['y'] + before_resize['height'] - 3)
        page.mouse.down()
        page.mouse.move(before_resize['x'] + before_resize['width'] - 103, before_resize['y'] + before_resize['height'] - 83, steps=12)
        page.mouse.up()
        resized = section.bounding_box()
        assert resized['width'] < before_resize['width'] - 40, (resized, before_resize)
        assert resized['height'] < before_resize['height'] - 30, (resized, before_resize)
        unchanged = state()
        content.evaluate('el=>el.scrollTop=100')
        scroll_before = content.evaluate('el=>el.scrollTop')
        assert scroll_before > 0

        minimize.click()
        mode('minimized')
        expect(content).to_be_hidden()
        expect(section.locator('.analysis-controls')).to_be_hidden()
        expect(title).to_be_visible()
        expect(minimize).to_have_attribute('aria-expanded', 'false')
        minimize.click()
        mode('normal')
        box_close(resized)
        assert content.evaluate('el=>el.scrollTop') == scroll_before
        assert state() == unchanged

        maximize.click()
        mode('maximized')
        expect(backdrop).to_be_visible()
        expect(maximize).to_have_attribute('aria-pressed', 'true')
        assert page.evaluate("document.body.classList.contains('analysis-maximized')")
        assert page.evaluate("getComputedStyle(document.body).overflow") == 'hidden'
        maxbox = section.bounding_box()
        assert abs(maxbox['x'] - 12) < 2 and abs(maxbox['y'] - 12) < 2
        assert maxbox['width'] > resized['width']
        assert state() == unchanged
        minimize.click()
        mode('minimized')
        expect(backdrop).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow") != 'hidden'
        minimize.click()
        mode('maximized')
        maximize.click()
        mode('normal')
        box_close(resized)
        assert state() == unchanged

        # Title double-click toggles, but double-clicking a control does not.
        title.dblclick()
        mode('maximized')
        section.locator('#analysis-column').dblclick()
        page.keyboard.press('Escape')
        mode('maximized')
        title.dblclick()
        mode('normal')
        box_close(resized)
        maximize.click()

        # Analysis dialog and graph settings remain usable in the enlarged window.
        page.click('#run-descriptive')
        expect(page.locator('#modal')).to_be_visible()
        page.select_option('#descriptive-column', '1')
        page.select_option('#group-select', '0')
        page.click('#modal button[value="ok"]')
        mode('maximized')
        expect(page.locator('.analysis-card')).to_have_count(1)
        page.locator('[data-group-plot-option="ciMean"]').check()
        number = page.locator('.group-confidence-control input[type="number"]')
        number.fill('99')
        expect(page.locator('.group-confidence-control input[type="range"]')).to_have_value('99')
        details = page.locator('.group-results details')
        details.locator('summary').click()
        details.locator('[data-group-select="none"]').click()
        details.get_by_role('checkbox', name=re.compile(r'^B · N = ')).check()
        expect(page.locator('[data-chart="group-ci-mean"] .group-ci-values tbody tr')).to_have_count(1)
        page.locator('.general-analysis [data-plot-option="histogram"]').uncheck()
        expect(page.locator('.general-analysis [data-chart="histogram"]')).to_have_count(0)
        mode('maximized')
        page.evaluate("sheet().rows[0][1]='30';touch()")
        page.locator('[data-refresh-analysis]').click()
        mode('maximized')
        expect(number).to_have_value('99')
        expect(page.locator('[data-chart="group-ci-mean"] .group-ci-values tbody tr')).to_have_count(1)

        # Rendering another sheet does not recreate or reset the analysis window.
        page.evaluate("const s=newSheet('Secondo foglio',['C1'],[['1']]);project.sheets.push(s);project.activeSheetId=s.id;render()")
        mode('maximized')
        expect(page.locator('#empty-analysis')).to_be_visible()
        page.evaluate('project.activeSheetId=project.sheets[0].id;render()')
        mode('maximized')
        expect(number).to_have_value('99')
        settings_after_edits = state()

        # The shared backdrop and scroll lock track the one maximized window.
        page.evaluate("setTableWindowMode('maximized')")
        mode('normal')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode', 'maximized')
        expect(backdrop).to_be_visible()
        assert not page.evaluate("document.body.classList.contains('analysis-maximized')")
        page.evaluate("setAnalysisWindowMode('maximized')")
        mode('maximized')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode', 'normal')
        assert not page.evaluate("document.body.classList.contains('table-maximized')")
        assert state() == settings_after_edits
        maximize.click()
        mode('normal')
        expect(backdrop).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow") != 'hidden'
        box_close(resized)

        # Existing data-table minimize/maximize controls retain their behavior.
        page.locator('.data-card').scroll_into_view_if_needed()
        page.click('#table-minimize')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode', 'minimized')
        page.click('#table-minimize')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode', 'normal')
        page.click('#table-maximize')
        expect(page.locator('.data-card')).to_have_attribute('data-window-mode', 'maximized')
        page.click('#table-maximize')
        expect(backdrop).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow") != 'hidden'
        assert state() == settings_after_edits
        assert not errors, errors
        print(route, 'PASS: mouse resize, minimize/maximize/restore, double-click, active analysis controls, retained options, sheet changes, shared backdrop and table regression')
        context.close()
    browser.close()
