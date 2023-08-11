// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {shallow} from 'enzyme';

import {CheckIcon} from '@mattermost/compass-icons/components';

import InfoToast from './info_toast';

describe('components/InfoToast', () => {
    const baseProps: ComponentProps<typeof InfoToast> = {
        content: {
            icon: <CheckIcon/>,
            message: 'test',
            undo: jest.fn(),
        },
        className: 'className',
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <InfoToast
                {...baseProps}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should close the toast on undo', () => {
        const wrapper = shallow(
            <InfoToast
                {...baseProps}
            />,
        );

        wrapper.find('button').simulate('click');
        expect(baseProps.onExited).toHaveBeenCalled();
    });

    test('should close the toast on close button click', () => {
        const wrapper = shallow(
            <InfoToast
                {...baseProps}
            />,
        );

        wrapper.find('.info-toast__icon_button').simulate('click');
        expect(baseProps.onExited).toHaveBeenCalled();
    });
});
