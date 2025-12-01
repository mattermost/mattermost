// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SearchHint from 'components/search_hint/search_hint';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {searchHintOptions} from 'utils/constants';

let mockState: any;

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    };
});

describe('components/SearchHint', () => {
    const baseProps = {
        withTitle: false,
        onOptionSelected: vi.fn(),
        options: searchHintOptions,
    };
    beforeEach(() => {
        mockState = {
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'true',
                    },
                },
                users: {
                    currentUserId: 'current_user_id',
                },
            },
        };
    });

    test('should match snapshot, with title', () => {
        const props = {
            ...baseProps,
            withTitle: true,
        };
        const {container} = renderWithContext(
            <SearchHint {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without title', () => {
        const {container} = renderWithContext(
            <SearchHint {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without searchType', () => {
        const props = {
            ...baseProps,
            withTitle: true,
            onSearchTypeSelected: vi.fn(),
            searchType: '' as 'files' | 'messages' | '',
        };
        const {container} = renderWithContext(
            <SearchHint {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with searchType', () => {
        const props = {
            ...baseProps,
            onSearchTypeSelected: vi.fn(),
            searchType: 'files' as 'files' | 'messages' | '',
        };
        const {container} = renderWithContext(
            <SearchHint {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
