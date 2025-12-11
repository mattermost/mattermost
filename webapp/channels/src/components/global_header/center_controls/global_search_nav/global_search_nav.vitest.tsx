// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import GlobalSearchNav from './global_search_nav';

describe('components/GlobalSearchNav', () => {
    test('should match snapshot with active flagged posts', () => {
        const state = {
            views: {
                rhs: {
                    rhsState: 'flag',
                    isSidebarOpen: true,
                },
            },
        };

        const {container} = renderWithContext(
            <GlobalSearchNav/>,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with active mentions posts', () => {
        const state = {
            views: {
                rhs: {
                    rhsState: 'mentions',
                    isSidebarOpen: true,
                },
            },
        };

        const {container} = renderWithContext(
            <GlobalSearchNav/>,
            state,
        );
        expect(container).toMatchSnapshot();
    });
});
