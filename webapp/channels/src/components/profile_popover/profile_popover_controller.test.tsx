// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {ProfilePopoverController} from './profile_popover_controller';

// Mock the child component (ProfilePopover)
jest.mock('./profile_popover', () => {
    return function MockProfilePopover(props: any) {
        return (
            <div data-testid='profile-popover'>
                {'Profile Popover Content for '}
                {props.userId}
                <button onClick={props.hide}>{'Close'}</button>
            </div>
        );
    };
});

describe('components/ProfilePopoverController', () => {
    const baseProps = {
        userId: 'user_123',
        src: 'http://example.com/image.png',
        username: 'username_abc',
        triggerComponentAs: 'button' as const,
        children: <span className='mention-link'>{'@username_abc'}</span>,
    };

    test('should render the mention link and open profile popover on click', async () => {
        const props = {
            ...baseProps,
        };

        renderWithContext(<ProfilePopoverController {...props}/>);

        const mention = screen.getByText('@username_abc');
        expect(mention).toBeInTheDocument();
        expect(mention.closest('button')).toBeInTheDocument();

        fireEvent.click(mention);

        expect(await screen.findByTestId('profile-popover')).toBeInTheDocument();
    });

    test("MM-67123 mention link uses type='button' to avoid submitting the parent form", async () => {
        const props = {
            ...baseProps,
        };

        const onSubmit = jest.fn();

        renderWithContext(
            <form onSubmit={onSubmit}>
                <ProfilePopoverController {...props}/>
            </form>);

        const mention = screen.getByText('@username_abc');
        expect(mention).toBeInTheDocument();
        const button = mention.closest('button');
        expect(button).toBeInTheDocument();
        expect(button!.type).toBe('button');
        fireEvent.click(mention);
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
