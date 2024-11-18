// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

import DraftActions from './draft_actions';

describe('components/drafts/draft_actions', () => {
    const baseProps = {
        displayName: '',
        draftId: '',
        itemId: '',
        onDelete: jest.fn(),
        onEdit: jest.fn(),
        onSend: jest.fn(),
        canSend: true,
        canEdit: true,
        onSchedule: jest.fn(),
        channelId: '',
    };

    it('should match snapshot', () => {
        const store = mockStore();

        const wrapper = shallow(
            <Provider store={store}>
                <DraftActions
                    {...baseProps}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
