// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import ConfirmModalRedux from './confirm_modal_redux';

describe('ConfirmModalRedux', () => {
    const baseProps = {
        onExited: jest.fn(),
    };

    // These tests will time out when failing, so we override the timeout period to make them fail faster.

    test('should call closeModal after confirming', (done) => {
        baseProps.onExited.mockImplementation(() => done());

        const wrapper = mountWithIntl(
            <ConfirmModalRedux
                {...baseProps}
            />,
        );

        expect(wrapper.find(Modal).prop('show')).toBe(true);
        expect(baseProps.onExited).not.toHaveBeenCalled();

        wrapper.find('#confirmModalButton').simulate('click');

        expect(wrapper.find(Modal).prop('show')).toBe(false);
    }, 5000);

    test('should call onExited after cancelling', (done) => {
        baseProps.onExited.mockImplementation(() => done());

        const wrapper = mountWithIntl(
            <ConfirmModalRedux
                {...baseProps}
            />,
        );

        expect(wrapper.find(Modal).prop('show')).toBe(true);
        expect(baseProps.onExited).not.toHaveBeenCalled();

        wrapper.find('#cancelModalButton').simulate('click');

        expect(wrapper.find(Modal).prop('show')).toBe(false);
    }, 5000);
});
