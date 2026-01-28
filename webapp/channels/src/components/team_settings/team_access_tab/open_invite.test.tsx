// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ComponentProps} from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import OpenInvite from './open_invite';

describe('components/TeamSettings/OpenInvite', () => {
    const setAllowOpenInvite = jest.fn().mockReturnValue({data: true});
    const defaultProps: ComponentProps<typeof OpenInvite> = {
        isGroupConstrained: false,
        allowOpenInvite: false,
        setAllowOpenInvite,
    };

    test('should render correct title and link when the team is constrained', () => {
        const props = {...defaultProps, isGroupConstrained: true};
        renderWithContext(<OpenInvite {...props}/>);
        const title = screen.getByText('Users on this server');
        expect(title).toBeInTheDocument();
        const externalLink = screen.getByText('Learn More');
        expect(externalLink).toBeInTheDocument();
        expect(externalLink).toHaveAttribute('href', 'https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html?utm_source=mattermost&utm_medium=in-product&utm_content=open_invite&uid=&sid=&edition=team&server_version=');
    });

    test('should render the checkbox when the team is not constrained and not checked', () => {
        renderWithContext(<OpenInvite {...defaultProps}/>);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
    });

    test('should render the checkbox when the team is not constrained and checked', () => {
        const props = {...defaultProps, allowOpenInvite: true};
        renderWithContext(<OpenInvite {...props}/>);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toBeChecked();
    });

    test('should call setAllowOpenInvite when the checkbox is clicked', async () => {
        renderWithContext(<OpenInvite {...defaultProps}/>);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
        await userEvent.click(checkbox);
        expect(setAllowOpenInvite).toHaveBeenCalledTimes(1);
        expect(setAllowOpenInvite).toHaveBeenCalledWith(true);
    });
});
