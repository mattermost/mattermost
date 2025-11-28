// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {describe, test, expect, vi} from 'vitest';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import Toast from './toast';
import type {Props} from './toast';

describe('components/Toast', () => {
    const defaultProps: Props = {
        onClick: vi.fn(),
        show: true,
        showActions: true,
        onClickMessage: (
            <FormattedMessage
                id='postlist.toast.scrollToBottom'
                defaultMessage='Jump to recents'
            />
        ),
        width: 1000,
    };

    test('should render toast when show is true', () => {
        renderWithContext(<Toast {...defaultProps}><span>{'child'}</span></Toast>);
        expect(screen.getByTestId('dismissToast')).toBeInTheDocument();
    });

    test('should render dismiss button', () => {
        renderWithContext(<Toast {...defaultProps}><span>{'child'}</span></Toast>);
        const dismissButton = screen.getByTestId('dismissToast');
        expect(dismissButton).toBeInTheDocument();
    });

    test('should call onDismiss when dismiss is clicked', () => {
        const onDismiss = vi.fn();
        renderWithContext(
            <Toast
                {...defaultProps}
                onDismiss={onDismiss}
            >
                <span>{'child'}</span>
            </Toast>,
        );

        screen.getByTestId('dismissToast').click();
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    test('should render children content', () => {
        renderWithContext(
            <Toast {...defaultProps}>
                <span>{'test child content'}</span>
            </Toast>,
        );
        expect(screen.getByText('test child content')).toBeInTheDocument();
    });
});
