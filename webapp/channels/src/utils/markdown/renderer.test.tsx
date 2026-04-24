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

describe('link (mmaction://)', () => {
    test('allowInlineActions=true emits placeholder span with action metadata', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        const result = renderer.link('mmaction://mx?tail=214', '', 'Click');

        expect(result).toContain('data-inline-action-id="mx"');
        expect(result).toContain('data-inline-action-params="tail=214"');
        expect(result).toContain('data-inline-action-post-id="p1"');
        expect(result).toContain('class="inline-action-button-placeholder"');
    });

    test('mixed-case actionId is preserved (URL.hostname would lowercase it)', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        const result = renderer.link('mmaction://MxPlan42?tail=214', '', 'Click');

        // The server action ID regex allows [A-Za-z0-9]+; losing case would
        // cause lookups to 404 when inline_actions keys are mixed-case.
        expect(result).toContain('data-inline-action-id="MxPlan42"');
    });

    test('opaque mmaction: URI (no //) returns plain text', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        // getScheme() accepts "mmaction:" without "//". Without an explicit
        // guard, slicing the authority would produce a silently-wrong action
        // ID. The renderer must fall through to plain text for this shape.
        const result = renderer.link('mmaction:MxPlan42', '', 'Click');

        expect(result).toBe('Click');
        expect(result).not.toContain('inline-action-button-placeholder');
    });

    test('path segments after authority are dropped from actionId', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        const result = renderer.link('mmaction://mx/extra/path?a=1', '', 'Click');

        expect(result).toContain('data-inline-action-id="mx"');
        expect(result).not.toContain('data-inline-action-id="mx/extra/path"');
    });

    test('allowInlineActions=false returns plain text', () => {
        const renderer = new Renderer({}, {allowInlineActions: false, postId: 'p1'});

        const result = renderer.link('mmaction://mx?tail=214', '', 'Click');

        expect(result).toBe('Click');
        expect(result).not.toContain('<span');
        expect(result).not.toContain('<a');
    });

    test('missing actionId returns plain text', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        const result = renderer.link('mmaction://', '', 'Click');

        expect(result).toBe('Click');
        expect(result).not.toContain('inline-action-button-placeholder');
    });

    test('empty postId returns plain text', () => {
        const renderer = new Renderer({}, {allowInlineActions: true});

        const result = renderer.link('mmaction://mx?tail=214', '', 'Click');

        expect(result).toBe('Click');
        expect(result).not.toContain('inline-action-button-placeholder');
    });

    test('oversized params returns plain text', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});
        const longValue = 'x'.repeat(2100); // > MAX_INLINE_ACTION_PARAMS_LENGTH (2048)
        const href = `mmaction://mx?k=${longValue}`;

        const result = renderer.link(href, '', 'Click');

        expect(result).toBe('Click');
        expect(result).not.toContain('inline-action-button-placeholder');
    });

    test('label with HTML tags is stripped to plain text', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        // `text` is marked's rendered link body. Tags should be stripped so
        // the label shows as plain text rather than literal "<img src=x>".
        const result = renderer.link('mmaction://mx?a=1', '', '<img src=x>');

        expect(result).toContain('inline-action-button-placeholder');
        expect(result).not.toContain('<img');
        expect(result).not.toContain('&lt;img');

        // The tag is fully removed, leaving an empty label in this case.
        expect(result).toContain('"></span>');
    });

    test('label with bold markup is flattened to plain text', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        // Marked would pass `<strong>Mx Plan</strong>` for `[**Mx Plan**](...)`.
        // The button label should read "Mx Plan", not the literal tag.
        const result = renderer.link('mmaction://mx?a=1', '', '<strong>Mx Plan</strong>');

        expect(result).toContain('>Mx Plan</span>');
        expect(result).not.toContain('<strong');
    });

    test('label with HTML entities is decoded before re-escaping', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        // Marked encodes `&` as `&amp;` in its rendered output. The label
        // should show "Items & Parts" (via &amp; in the final HTML), not
        // the doubly-encoded "Items &amp;amp; Parts".
        const result = renderer.link('mmaction://mx?a=1', '', 'Items &amp; Parts');

        expect(result).toContain('>Items &amp; Parts</span>');
        expect(result).not.toContain('&amp;amp;');
    });

    test('query params with special chars are preserved (URL-encoded)', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p1'});

        const result = renderer.link('mmaction://mx?a=%26%3D&b=foo', '', 'Click');

        // The raw URL query string is embedded in the data attribute, with &
        // HTML-escaped to &amp;. After HTML-decoding, the value round-trips to
        // the original percent-encoded form.
        expect(result).toContain('data-inline-action-params="a=%26%3D&amp;b=foo"');
    });

    test('postId with HTML metacharacters is escaped in the data attribute', () => {
        const renderer = new Renderer({}, {allowInlineActions: true, postId: 'p"><script>x</script>'});

        const result = renderer.link('mmaction://mx?a=1', '', 'Click');

        // Raw injection attempt must not survive in the attribute value.
        expect(result).not.toContain('"><script>');
        expect(result).toContain('&lt;script&gt;');
    });
});
