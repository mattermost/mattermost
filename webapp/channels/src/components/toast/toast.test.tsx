// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import Toast from './toast';
import type {Props} from './toast';

describe('components/Toast', () => {
    const defaultProps: Props = {
        onClick: jest.fn(),
        show: true,
        showActions: true,
        onClickMessage: (
            <FormattedMessage
                id='postlist.toast.scrollToBottom'
                defaultMessage='Jump to recents'
            />
        ),
        width: 1000,
        testIdScope: 'center.post_list.toast',
        testKey: 'unread',
    };

    test('should render for showing toast', () => {
        renderWithContext(<Toast {...defaultProps}><span>{'child'}</span></Toast>);
        expect(screen.getByTestId('center.post_list.toast.dismiss--button')).toBeInTheDocument();
    });

    test('should dismiss', () => {
        defaultProps.onDismiss = jest.fn();

        renderWithContext(
            <Toast {... defaultProps}>
                <span>{'child'}</span>
            </Toast>,
        );

        screen.getByTestId('center.post_list.toast.dismiss--button').click();

        expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
    });
});
