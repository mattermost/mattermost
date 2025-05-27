// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import PasswordResetSendLink from './password_reset_send_link';
import type {PasswordResetSendLink as PasswordResetSendLinkType} from './password_reset_send_link';

describe('components/PasswordResetSendLink', () => {
    const baseProps = {
        actions: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue({data: true}),
        },
    };

    it('should calls sendPasswordResetEmail() action on submit', () => {
        const props = {...baseProps};

        const wrapper = mountWithIntl(
            <MemoryRouter>
                <PasswordResetSendLink {...props}/>
            </MemoryRouter>,
        ).children().children().children();

        (wrapper.instance() as PasswordResetSendLinkType).emailInput.current!.value = 'test@example.com';
        wrapper.find('form').simulate('submit', {preventDefault: () => {}});

        expect(props.actions.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
    });
});
