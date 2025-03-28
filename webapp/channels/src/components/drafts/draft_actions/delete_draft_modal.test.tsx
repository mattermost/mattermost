// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import mockStore from 'tests/test_store';

import DeleteDraftModal from './delete_draft_modal';

describe('components/drafts/draft_actions/delete_draft_modal', () => {
    const baseProps = {
        displayName: 'display_name',
        onConfirm: jest.fn(),
        onExited: jest.fn(),
    };

    it('should match snapshot', () => {
        const store = mockStore();

        const wrapper = shallow(
            <Provider store={store}>
                <DeleteDraftModal
                    {...baseProps}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should have called onConfirm', () => {
        const wrapper = shallow(
            <DeleteDraftModal {...baseProps}/>,
        );

        wrapper.find(GenericModal).first().props().handleConfirm!();
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(wrapper).toMatchSnapshot();
    });

    it('should have called onExited', () => {
        const wrapper = shallow(
            <DeleteDraftModal {...baseProps}/>,
        );

        wrapper.find(GenericModal).first().props().onExited?.();
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
        expect(wrapper).toMatchSnapshot();
    });
});
