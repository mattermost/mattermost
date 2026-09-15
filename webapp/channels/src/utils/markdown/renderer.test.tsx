// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Renderer from './renderer';

describe('code', () => {
    test('too many tokens result in no search rendering', () => {
        const renderer = new Renderer({}, {searchPatterns: [{pattern: new RegExp('\\b()(foo)\\b', 'gi'), term: 'foo'}]});
        let originalString = 'foo '.repeat(501);
        let result = renderer.code(originalString, '');

        expect(result.includes('post-code__search-highlighting')).toBeTruthy();

        originalString = originalString.repeat(2);
        result = renderer.code(originalString, '');

        expect(result.includes('post-code__search-highlighting')).toBeFalsy();
    });
});

describe('codespan', () => {
    test('too many tokens result in no search rendering', () => {
        const renderer = new Renderer({}, {searchPatterns: [{pattern: new RegExp('\\b()(foo)\\b', 'gi'), term: 'foo'}]});
        let originalString = 'foo '.repeat(501);
        let result = renderer.codespan(originalString);

        expect(result.includes('search-highlight')).toBeTruthy();

        originalString = originalString.repeat(2);
        result = renderer.codespan(originalString);

        expect(result.includes('search-highlight')).toBeFalsy();
    });
});

describe('listitem', () => {
    test('should render tight task list items as checkboxes', () => {
        const renderer = new Renderer({}, {});

        expect(renderer.listitem('[x] Completed task')).toBe(
            '<li class="list-item--task-list"><input type="checkbox" disabled="disabled" checked="checked" /> Completed task</li>',
        );
        expect(renderer.listitem('[ ] Incomplete task')).toBe(
            '<li class="list-item--task-list"><input type="checkbox" disabled="disabled" /> Incomplete task</li>',
        );
    });

    test('should render loose task list items wrapped in paragraphs as checkboxes', () => {
        const renderer = new Renderer({}, {});

        expect(renderer.listitem('<p>[x] Completed task</p>')).toBe(
            '<li class="list-item--task-list"><input type="checkbox" disabled="disabled" checked="checked" /> <p>Completed task</p></li>',
        );
        expect(renderer.listitem('<p>[ ] Incomplete task</p>')).toBe(
            '<li class="list-item--task-list"><input type="checkbox" disabled="disabled" /> <p>Incomplete task</p></li>',
        );
    });

    test('should not treat a pipe character as a task checkbox marker', () => {
        const renderer = new Renderer({}, {});

        expect(renderer.listitem('[|] not a task')).toBe('<li>[|] not a task</li>');
        expect(renderer.listitem('<p>[|] not a task</p>')).toBe('<li><p>[|] not a task</p></li>');
    });
});

describe('link (mmaction://)', () => {
    // mmaction:// links are rendered as plain anchors here; the conversion to
    // <InlineActionButton> happens in messageHtmlToComponent. Validation lives
    // in the component itself. These tests just lock the contract that the
    // renderer leaves the href intact for downstream interception.
    test('mmaction:// href passes through as a normal anchor', () => {
        const renderer = new Renderer({}, {});

        const result = renderer.link('mmaction://mx?tail=214', '', 'Click');

        expect(result).toContain('href="mmaction://mx?tail=214"');
        expect(result).toContain('>Click</a>');
    });
});
