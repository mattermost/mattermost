// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {ComponentProps} from 'react';
import React from 'react';
import {Provider} from 'react-redux';

import type {UserProfile, UserStatus} from '@mattermost/types/users';

import mockStore from 'tests/test_store';

import type {PostDraft} from 'types/store/draft';

import DraftRow from './draft_row';

describe('components/drafts/drafts_row', () => {
    const baseProps: ComponentProps<typeof DraftRow> = {
        item: {} as PostDraft,
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
            draft: {rootId: 'some_id'} as PostDraft,
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
