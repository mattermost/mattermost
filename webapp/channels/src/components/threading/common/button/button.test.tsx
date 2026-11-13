// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ReplyIcon from 'components/widgets/icons/reply_icon';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import Button from './button';

describe('components/threading/common/button', () => {
    test('should support onClick', async () => {
        const action = jest.fn();

        const {container} = render(
            <Button
                onClick={action}
            />,
        );

        await userEvent.click(container.querySelector('button')!);
        expect(action).toHaveBeenCalled();
    });

    test('should support className', () => {
        const className = 'test-class other-test-class';
        const {container} = render(
            <Button
                className={className}
            />,
        );

        const button = container.querySelector('button')!;
        expect(button.classList.contains('test-class')).toBe(true);
        expect(button.classList.contains('other-test-class')).toBe(true);
    });

    test('should support prepended content', () => {
        const {container} = render(
            <Button
                prepend={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(container.querySelector('.Button_prepended')).toBeInTheDocument();
    });

    test('should support appended content', () => {
        const {container} = render(
            <Button
                append={<ReplyIcon className='Icon'/>}
            />,
        );

        expect(container.querySelector('.Button_appended')).toBeInTheDocument();
    });

    test('should support children', () => {
        render(
            <Button>
                {'text-goes-here'}
            </Button>,
        );
        expect(screen.getByText('text-goes-here')).toBeInTheDocument();
    });
});
