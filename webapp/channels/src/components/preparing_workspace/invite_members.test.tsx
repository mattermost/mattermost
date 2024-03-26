// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {fireEvent, render, screen} from 'tests/react_testing_utils';

import InviteMembers from './invite_members';

describe('InviteMembers component', () => {
    let defaultProps: ComponentProps<any>;
    const setEmailsFn = jest.fn();

    beforeEach(() => {
        defaultProps = {
            disableEdits: false,
            browserSiteUrl: 'https://my-org.mattermost.com',
            formUrl: 'https://my-org.mattermost.com/signup',
            teamInviteId: '1234',
            className: 'test-class',
            configSiteUrl: 'https://my-org.mattermost.com/config',
            onPageView: jest.fn(),
            previous: <div>{'Previous step'}</div>,
            next: jest.fn(),
            setEmails: setEmailsFn,
            show: true,
            transitionDirection: 'forward',
            inferredProtocol: null,
            isSelfHosted: true,
            emails: [],
        };
    });

    it('should match snapshot', () => {
        const component = withIntl(<InviteMembers {...defaultProps}/>);
        const {container} = render(component);
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot when it is cloud', () => {
        const component = withIntl(
            <InviteMembers
                {...defaultProps}
                isSelfHosted={false}
            />,
        );
        const {container} = render(component);
        expect(container).toMatchSnapshot();
    });

    it('renders invite URL', () => {
        const component = withIntl(<InviteMembers {...defaultProps}/>);
        render(component);
        const inviteLink = screen.getByTestId('shareLinkInput');
        expect(inviteLink).toHaveAttribute(
            'value',
            'https://my-org.mattermost.com/config/signup_user_complete/?id=1234',
        );
    });

    it('renders submit button with correct text', () => {
        const component = withIntl(<InviteMembers {...defaultProps}/>);
        render(component);
        const button = screen.getByRole('button', {name: 'Finish setup'});
        expect(button).toBeInTheDocument();
    });

    it('button is disabled when disableEdits is true', () => {
        const component = withIntl(
            <InviteMembers
                {...defaultProps}
                disableEdits={true}
            />,
        );
        render(component);
        const button = screen.getByRole('button', {name: 'Finish setup'});
        expect(button).toBeDisabled();
    });

    it('invokes next prop on button click', () => {
        const component = withIntl(<InviteMembers {...defaultProps}/>);
        render(component);
        const button = screen.getByRole('button', {name: 'Finish setup'});
        fireEvent.click(button);
        expect(defaultProps.next).toHaveBeenCalled();
    });

    it('shows send invites button when in cloud', () => {
        const component = withIntl(
            <InviteMembers
                {...defaultProps}
                isSelfHosted={false}
            />,
        );
        render(component);
        const button = screen.getByRole('button', {name: 'Send invites'});
        expect(button).toBeInTheDocument();
    });
});
