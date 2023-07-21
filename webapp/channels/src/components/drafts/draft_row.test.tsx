// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile, UserStatus} from '@mattermost/types/users';
import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import {Draft} from 'selectors/drafts';

import mockStore from 'tests/test_store';

import DraftRow from './draft_row';

describe('components/drafts/drafts_row', () => {
    const baseProps = {
        draft: {
            type: 'channel',
        } as Draft,
        user: {} as UserProfile,
        status: {} as UserStatus['status'],
        displayName: 'test',
        isRemote: false,
    };

    it('should match snapshot for channel draft', () => {
        const store = mockStore();

        const wrapper = shallow(
            <Provider store={store}>
                <DraftRow
                    {...baseProps}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for thread draft', () => {
        const store = mockStore();

        const props = {
            ...baseProps,
            draft: {
                ...baseProps.draft,
                type: 'thread',
            } as Draft,
        };

        const wrapper = shallow(
            <Provider store={store}>
                <DraftRow
                    {...props}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
