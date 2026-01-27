// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SearchHint from 'components/search_hint/search_hint';

import {renderWithContext} from 'tests/react_testing_utils';
import {searchHintOptions} from 'utils/constants';

describe('components/SearchHint', () => {
    const baseProps = {
        withTitle: false,
        onOptionSelected: jest.fn(),
        options: searchHintOptions,
    };

    const initialState = {
        entities: {
            general: {
                config: {
                    EnableFileAttachments: 'true',
                },
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    test('should match snapshot, with title', () => {
        const props = {
            ...baseProps,
            withTitle: true,
        };
        const {container} = renderWithContext(
            <SearchHint {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without title', () => {
        const {container} = renderWithContext(
            <SearchHint {...baseProps}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without searchType', () => {
        const props = {
            ...baseProps,
            withTitle: true,
            onSearchTypeSelected: jest.fn(),
            searchType: '' as 'files' | 'messages' | '',
        };
        const {container} = renderWithContext(
            <SearchHint {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with searchType', () => {
        const props = {
            ...baseProps,
            onSearchTypeSelected: jest.fn(),
            searchType: 'files' as 'files' | 'messages' | '',
        };
        const {container} = renderWithContext(
            <SearchHint {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });
});
