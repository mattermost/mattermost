// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import {IntlProvider} from 'react-intl';
import configureStore from 'redux-mock-store';

import DmButton from '../dm_button';

const mockStore = configureStore([]);

const renderWithProviders = (component: React.ReactElement, storeState = {}) => {
    const defaultState = {
        entities: {
            channels: {channels: {}, myMembers: {}},
            users: {profiles: {}},
        },
        ...storeState,
    };
    const store = mockStore(defaultState);

    return render(
        <Provider store={store}>
            <IntlProvider locale='en'>
                {component}
            </IntlProvider>
        </Provider>
    );
};

describe('DmButton', () => {
    const defaultProps = {
        isActive: false,
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the DM button', () => {
        renderWithProviders(<DmButton {...defaultProps} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).toBeInTheDocument();
    });

    it('has dm-button class', () => {
        renderWithProviders(<DmButton {...defaultProps} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).toHaveClass('dm-button');
    });

    it('has active class when isActive is true', () => {
        renderWithProviders(<DmButton {...defaultProps} isActive={true} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).toHaveClass('dm-button--active');
    });

    it('does not have active class when isActive is false', () => {
        renderWithProviders(<DmButton {...defaultProps} isActive={false} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).not.toHaveClass('dm-button--active');
    });

    it('calls onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithProviders(<DmButton {...defaultProps} onClick={onClick} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        fireEvent.click(button);

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('shows active indicator when isActive', () => {
        const {container} = renderWithProviders(<DmButton {...defaultProps} isActive={true} />);

        expect(container.querySelector('.dm-button__active-indicator')).toBeInTheDocument();
    });

    it('does not show active indicator when not active', () => {
        const {container} = renderWithProviders(<DmButton {...defaultProps} isActive={false} />);

        expect(container.querySelector('.dm-button__active-indicator')).not.toBeInTheDocument();
    });

    it('shows unread badge when unreadCount > 0', () => {
        const stateWithUnreads = {
            entities: {
                channels: {
                    channels: {
                        dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                    },
                    myMembers: {
                        dm1: {channel_id: 'dm1', mention_count: 5},
                    },
                },
                users: {profiles: {}},
            },
        };
        const {container} = renderWithProviders(
            <DmButton {...defaultProps} />,
            stateWithUnreads,
        );

        expect(container.querySelector('.dm-button__badge')).toBeInTheDocument();
    });

    it('shows 99+ when unread count exceeds 99', () => {
        const stateWithManyUnreads = {
            entities: {
                channels: {
                    channels: {
                        dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                    },
                    myMembers: {
                        dm1: {channel_id: 'dm1', mention_count: 150},
                    },
                },
                users: {profiles: {}},
            },
        };
        renderWithProviders(<DmButton {...defaultProps} />, stateWithManyUnreads);

        expect(screen.getByText('99+')).toBeInTheDocument();
    });
});
