// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';
import type {ComponentProps} from 'react';
import {describe, test, expect, vi, beforeEach} from 'vitest';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

import InviteMembers from './invite_members';
import {Animations} from './steps';

describe('InviteMembers component', () => {
    let defaultProps: ComponentProps<typeof InviteMembers>;
    const setEmailsFn = vi.fn();

    beforeEach(() => {
        defaultProps = {
            disableEdits: false,
            browserSiteUrl: 'https://my-org.mattermost.com',
            formUrl: 'https://my-org.mattermost.com/signup',
            teamInviteId: '1234',
            className: 'test-class',
            configSiteUrl: 'https://my-org.mattermost.com/config',
            previous: <div>{'Previous step'}</div>,
            next: vi.fn(),
            setEmails: setEmailsFn,
            show: true,
            transitionDirection: Animations.Reasons.EnterFromBefore,
            inferredProtocol: null,
            isSelfHosted: true,
            emails: [],
        };
    });

    test('should match snapshot', () => {
        const {container} = renderWithIntl(<InviteMembers {...defaultProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when it is cloud', () => {
        const {container} = renderWithIntl(
            <InviteMembers
                {...defaultProps}
                isSelfHosted={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('renders invite URL', () => {
        renderWithIntl(<InviteMembers {...defaultProps}/>);
        const inviteLink = screen.getByTestId('shareLinkInput');
        expect(inviteLink).toHaveAttribute(
            'value',
            'https://my-org.mattermost.com/config/signup_user_complete/?id=1234',
        );
    });

    test('renders submit button with correct text', () => {
        renderWithIntl(<InviteMembers {...defaultProps}/>);
        const button = screen.getByRole('button', {name: 'Finish setup'});
        expect(button).toBeInTheDocument();
    });

    test('button is disabled when disableEdits is true', () => {
        renderWithIntl(
            <InviteMembers
                {...defaultProps}
                disableEdits={true}
            />,
        );
        const button = screen.getByRole('button', {name: 'Finish setup'});
        expect(button).toBeDisabled();
    });

    test('invokes next prop on button click', () => {
        renderWithIntl(<InviteMembers {...defaultProps}/>);
        const button = screen.getByRole('button', {name: 'Finish setup'});
        fireEvent.click(button);
        expect(defaultProps.next).toHaveBeenCalled();
    });

    test('shows send invites button when in cloud', () => {
        renderWithIntl(
            <InviteMembers
                {...defaultProps}
                isSelfHosted={false}
            />,
        );
        const button = screen.getByRole('button', {name: 'Send invites'});
        expect(button).toBeInTheDocument();
    });
});
