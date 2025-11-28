// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import UnreadChannelIndicator from './unread_channel_indicator';

describe('UnreadChannelIndicator', () => {
    const baseProps = {
        onClick: vi.fn(),
        show: true,
    };

    test('should match snapshot', () => {
        const props = {
            ...baseProps,
            show: false,
        };

        const {container} = render(
            <UnreadChannelIndicator {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when show is set', () => {
        const {container} = render(
            <UnreadChannelIndicator {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when content is text', () => {
        const props = {
            ...baseProps,
            content: 'foo',
        };

        const {container} = render(
            <UnreadChannelIndicator {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when content is an element', () => {
        const props = {
            ...baseProps,
            content: <div>{'foo'}</div>,
        };

        const {container} = render(
            <UnreadChannelIndicator {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should have called onClick', () => {
        const onClick = vi.fn();
        const props = {
            ...baseProps,
            onClick,
            content: <div>{'foo'}</div>,
            name: 'name',
        };

        render(
            <UnreadChannelIndicator {...props}/>,
        );

        const indicator = screen.getByText('foo').closest('.nav-pills__unread-indicator');
        fireEvent.click(indicator!);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
