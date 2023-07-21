// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import * as Utils from 'utils/utils';

import AtMentionSuggestion, {Item} from './at_mention_suggestion';

jest.mock('components/custom_status/custom_status_emoji', () => () => <div/>);
jest.spyOn(Utils, 'getFullName').mockReturnValue('a b');

describe('at mention suggestion', () => {
    const userid1 = {
        id: 'userid1',
        username: 'user',
        first_name: 'a',
        last_name: 'b',
        nickname: 'c',
        isCurrentUser: true,
    } as Item;

    const userid2 = {
        id: 'userid2',
        username: 'user2',
        first_name: 'a',
        last_name: 'b',
        nickname: 'c',
    } as Item;

    const baseProps = {
        matchedPretext: '@',
        term: '@user',
        isSelection: false,
        onClick: jest.fn(),
        onMouseMove: jest.fn(),
    };

    it('Should not display nick name of the signed in user', () => {
        const wrapper = mountWithIntl(
            <AtMentionSuggestion
                {...baseProps}
                item={userid1}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('.suggestion-list__ellipsis').text()).toContain('a b');
        expect(wrapper.find('.suggestion-list__ellipsis').text()).not.toContain('a b (c)');
    });

    it('Should display nick name of non signed in user', () => {
        const wrapper = mountWithIntl(
            <AtMentionSuggestion
                {...baseProps}
                item={userid2}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('.suggestion-list__ellipsis').text()).toContain('a b (c)');
    });
});
