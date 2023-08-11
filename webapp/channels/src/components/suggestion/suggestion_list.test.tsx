// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import SuggestionList from 'components/suggestion/suggestion_list';

describe('components/SuggestionList', () => {
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
        const wrapper = shallow<SuggestionList>(
            <SuggestionList
                {...baseProps}
                ariaLiveRef={React.createRef()}
            />,
        );

        const instance = wrapper.instance();
        instance.currentLabel = null;

        instance.generateLabel({});
    });
});
