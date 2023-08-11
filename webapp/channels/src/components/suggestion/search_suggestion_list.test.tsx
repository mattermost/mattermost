// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import SearchSuggestionList from 'components/suggestion/search_suggestion_list';

import {TestHelper} from 'utils/test_helper';

describe('components/SearchSuggestionList', () => {
    const baseProps = {
        open: true,
        onCompleteWord: jest.fn(),
        pretext: '',
        cleared: false,
        matchedPretext: [],
        items: [],
        terms: [],
        selection: '',
        components: [],
        onItemHover: jest.fn(),
    };

    test('should not throw error when currentLabel is null and label is generated', () => {
        const userProfile = TestHelper.getUserMock();
        const item = {
            ...userProfile,
            type: 'item_type',
            display_name: 'item_display_name',
            name: 'item_name',
        };

        const wrapper = shallow(
            <SearchSuggestionList
                {...baseProps}
                ariaLiveRef={React.createRef()}
            />,
        );

        const instance = wrapper.instance() as SearchSuggestionList;
        instance.currentLabel = null as any;

        instance.generateLabel(item);
    });
});
