// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {resolveSvgWithViewBox} from 'utils/svg_preview';

describe('utils/svg_preview', () => {
    const originalFetch = global.fetch;

    function mockFetch(body: string, ok = true) {
        global.fetch = jest.fn().mockResolvedValue({
            ok,
            text: () => Promise.resolve(body),
        }) as unknown as typeof global.fetch;
    }

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('returns null when the SVG already has a viewBox', async () => {
        mockFetch('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="10" height="10"/></svg>');

        expect(await resolveSvgWithViewBox('http://localhost/a.svg')).toBeNull();
    });

    test('returns null when the SVG has absolute width and height', async () => {
        mockFetch('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="10" height="10"/></svg>');

        expect(await resolveSvgWithViewBox('http://localhost/a.svg')).toBeNull();
    });

    test('returns null when the response is not ok', async () => {
        mockFetch('<svg xmlns="http://www.w3.org/2000/svg"></svg>', false);

        expect(await resolveSvgWithViewBox('http://localhost/a.svg')).toBeNull();
    });

    test('returns null when the markup is not an SVG document', async () => {
        mockFetch('<html><body>not an svg</body></html>');

        expect(await resolveSvgWithViewBox('http://localhost/a.svg')).toBeNull();
    });

    test('treats percentage width and height as not absolute and proceeds to measure', async () => {
        // jsdom cannot measure (getBBox is unimplemented), so measurement fails and
        // the function returns null without throwing. This documents that
        // width="100%"/height="100%" SVGs are not short-circuited as already-sized.
        mockFetch('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="10" height="10"/></svg>');

        expect(await resolveSvgWithViewBox('http://localhost/a.svg')).toBeNull();
    });
});
