// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BackstageNavbar from './backstage_navbar';

describe('components/backstage/components/BackstageNavbar', () => {
    const activeTeam = {
        name: 'my-team',
        display_name: 'My Team',
        delete_at: 0,
    } as Team;

    test('should render back link to team channel when team exists', () => {
        renderWithContext(
            <BackstageNavbar
                team={activeTeam}
                siteName='Mattermost'
            />,
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/my-team');
        expect(screen.getByText('Back to Mattermost')).toBeInTheDocument();
    });

    test('should use team display_name when siteName is not provided', () => {
        renderWithContext(
            <BackstageNavbar team={activeTeam}/>,
        );

        expect(screen.getByText('Back to My Team')).toBeInTheDocument();
    });

    test('should render generic back link when team is undefined', () => {
        renderWithContext(
            <BackstageNavbar/>,
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/');
        expect(screen.getByText('Back')).toBeInTheDocument();
    });

    test('should render generic back link when team is deleted', () => {
        const deletedTeam = {
            ...activeTeam,
            delete_at: 1234567890,
        } as Team;

        renderWithContext(
            <BackstageNavbar
                team={deletedTeam}
                siteName='Mattermost'
            />,
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/');
        expect(screen.getByText('Back')).toBeInTheDocument();
    });
});
