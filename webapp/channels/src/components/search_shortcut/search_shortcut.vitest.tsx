// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SearchShortcut} from 'components/search_shortcut';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/SearchShortcut', () => {
    test('should match snapshot on Windows webapp', () => {
        vi.mock('utils/user_agent', () => {
            return {
                isDesktopApp: vi.fn(() => false),
                isMac: vi.fn(() => false),
            };
        });

        const {container} = renderWithContext(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Mac webapp', () => {
        vi.mock('utils/user_agent', () => {
            return {
                isDesktopApp: vi.fn(() => false),
                isMac: vi.fn(() => true),
            };
        });

        const {container} = renderWithContext(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Windows desktop', () => {
        vi.mock('utils/user_agent', () => {
            return {
                isDesktopApp: vi.fn(() => true),
                isMac: vi.fn(() => true),
            };
        });

        const {container} = renderWithContext(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on Mac desktop', () => {
        vi.mock('utils/user_agent', () => {
            return {
                isDesktopApp: vi.fn(() => true),
                isMac: vi.fn(() => true),
            };
        });

        const {container} = renderWithContext(<SearchShortcut/>);
        expect(container).toMatchSnapshot();
    });
});
