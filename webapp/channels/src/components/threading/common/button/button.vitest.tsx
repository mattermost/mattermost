// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import ReplyIcon from 'components/widgets/icons/reply_icon';

import Button from './button';

describe('components/threading/common/button', () => {
    test('should support onClick', () => {
        const action = vi.fn();

        const {container} = render(
            <Button
                onClick={action}
            />,
        );

        expect(container).toMatchSnapshot();

        fireEvent.click(screen.getByRole('button'));
        expect(action).toHaveBeenCalled();
    });

    test('should support className', () => {
        const className = 'test-class other-test-class';
        const {container} = render(
            <Button
                className={className}
            />,
        );

        expect(container).toMatchSnapshot();

        const button = screen.getByRole('button');
        expect(button).toHaveClass('test-class');
        expect(button).toHaveClass('other-test-class');
    });

    test('should support prepended content', () => {
        const {container} = render(
            <Button
                prepend={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(container).toMatchSnapshot();

        expect(container.querySelector('.Button_prepended')).toBeInTheDocument();
    });

    test('should support appended content', () => {
        const {container} = render(
            <Button
                append={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(container).toMatchSnapshot();

        expect(container.querySelector('.Button_appended')).toBeInTheDocument();
    });

    test('should support children', () => {
        const {container} = render(
            <Button>
                {'text-goes-here'}
            </Button>,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('text-goes-here')).toBeInTheDocument();
    });
});
