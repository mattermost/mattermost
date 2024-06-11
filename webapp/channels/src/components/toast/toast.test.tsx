// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import * as Utils from 'utils/utils';

import Toast from './toast';
import type {Props} from './toast';

describe('components/Toast', () => {
    const defaultProps: Props = {
        onClick: jest.fn(),
        show: true,
        showActions: true,
        onClickMessage: Utils.localizeMessage('postlist.toast.scrollToBottom', 'Jump to recents'),
        width: 1000,
    };

    test('should match snapshot for showing toast', () => {
        const wrapper = shallow<Toast>(<Toast {...defaultProps}><span>{'child'}</span></Toast>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for hiding toast', () => {
        const wrapper = shallow<Toast>(<Toast {...{...defaultProps, show: false}}><span>{'child'}</span></Toast>);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.toast__visible').length).toBe(0);
    });

    test('should match snapshot for toast width less than 780px', () => {
        const wrapper = shallow<Toast>(<Toast {...{...defaultProps, width: 779}}><span>{'child'}</span></Toast>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot to not have actions', () => {
        const wrapper = shallow<Toast>(<Toast {...{...defaultProps, showActions: false}}><span>{'child'}</span></Toast>);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.toast__pointer').length).toBe(0);
    });

    test('should dismiss', () => {
        defaultProps.onDismiss = jest.fn();

        renderWithContext(
            <Toast {... defaultProps}>
                <span>{'child'}</span>
            </Toast>,
        );

        screen.getByTestId('dismissToast').click();

        expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
    });

    test('should match snapshot to have extraClasses', () => {
        const wrapper = shallow<Toast>(<Toast {...{...defaultProps, extraClasses: 'extraClasses'}}><span>{'child'}</span></Toast>);
        expect(wrapper).toMatchSnapshot();
    });
});
