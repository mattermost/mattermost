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

    test('should match snapshot for showing toast', () => {
        const {container} = renderWithContext(<Toast {...defaultProps}><span>{'child'}</span></Toast>);
        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('dismissToast')).toBeInTheDocument();
    });

    test('should match snapshot for hiding toast', () => {
        const {container} = renderWithContext(<Toast {...{...defaultProps, show: false}}><span>{'child'}</span></Toast>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for toast width less than 780px', () => {
        const {container} = renderWithContext(<Toast {...{...defaultProps, width: 779}}><span>{'child'}</span></Toast>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot to not have actions', () => {
        const {container} = renderWithContext(<Toast {...{...defaultProps, showActions: false}}><span>{'child'}</span></Toast>);
        expect(container).toMatchSnapshot();
    });

    test('should dismiss', () => {
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

    test('should match snapshot to have extraClasses', () => {
        const {container} = renderWithContext(<Toast {...{...defaultProps, extraClasses: 'extraClasses'}}><span>{'child'}</span></Toast>);
        expect(container).toMatchSnapshot();
    });
});
