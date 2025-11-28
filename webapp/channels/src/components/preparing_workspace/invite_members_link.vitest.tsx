// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import InviteMembersLink from './invite_members_link';

describe('components/preparing-workspace/invite_members_link', () => {
    const inviteURL = 'https://invite-url.mattermost.com';

    test('should match snapshot', () => {
        const {container} = renderWithIntl(<InviteMembersLink inviteURL={inviteURL}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when displayed including the input field', () => {
        const {container} = renderWithIntl(
            <InviteMembersLink
                inviteURL={inviteURL}
                inputAndButtonStyle={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('renders only with the button if the inputAndButton option is false', () => {
        renderWithIntl(
            <InviteMembersLink
                inviteURL={inviteURL}
                inputAndButtonStyle={false}
            />,
        );
        const input = screen.queryByText(inviteURL);
        expect(input).not.toBeInTheDocument();
        const button = screen.getByRole('button', {name: /copy link/i});
        expect(button).toBeInTheDocument();
    });

    test('renders an input field with the invite URL', () => {
        renderWithIntl(
            <InviteMembersLink
                inviteURL={inviteURL}
                inputAndButtonStyle={true}
            />,
        );
        const input = screen.getByDisplayValue(inviteURL);
        expect(input).toBeInTheDocument();
    });

    test('renders a button to copy the invite URL', () => {
        renderWithIntl(<InviteMembersLink inviteURL={inviteURL}/>);
        const button = screen.getByRole('button', {name: /copy link/i});
        expect(button).toBeInTheDocument();
    });

    test('changes the button text to "Link Copied" when the URL is copied', () => {
        renderWithIntl(<InviteMembersLink inviteURL={inviteURL}/>);
        const button = screen.getByRole('button', {name: /copy link/i});
        const originalText = 'Copy Link';
        const linkCopiedText = 'Link Copied';
        expect(button).toHaveTextContent(originalText);

        fireEvent.click(button);

        expect(button).toHaveTextContent(linkCopiedText);
    });
});
