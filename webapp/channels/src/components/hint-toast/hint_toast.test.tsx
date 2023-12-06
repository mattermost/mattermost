// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {HintToast} from './hint_toast';

describe('components/HintToast', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <HintToast
                onDismiss={jest.fn()}
            >{'A hint'}</HintToast>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should fire onDismiss callback', () => {
        const dismissHandler = jest.fn();
        const wrapper = shallow(
            <HintToast
                onDismiss={dismissHandler}
            >{'A hint'}</HintToast>,
        );

        wrapper.find('.hint-toast__dismiss').simulate('click');

        expect(dismissHandler).toHaveBeenCalled();
    });
});
