// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SearchHint from 'components/search_hint/search_hint';

import {searchHintOptions} from 'utils/constants';

let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

describe('components/SearchHint', () => {
    const baseProps = {
        withTitle: false,
        onOptionSelected: jest.fn(),
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
            },
        };
    });

    test('should match snapshot, with title', () => {
        const props = {
            ...baseProps,
            withTitle: true,
        };
        const wrapper = shallow(
            <SearchHint {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without title', () => {
        const wrapper = shallow(
            <SearchHint {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without searchType', () => {
        const props = {
            ...baseProps,
            withTitle: true,
            onSearchTypeSelected: jest.fn(),
            searchType: '' as 'files' | 'messages' | '',
        };
        const wrapper = shallow(
            <SearchHint {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with searchType', () => {
        const props = {
            ...baseProps,
            onSearchTypeSelected: jest.fn(),
            searchType: 'files' as 'files' | 'messages' | '',
        };
        const wrapper = shallow(
            <SearchHint {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
