// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {FormattedMessage} from 'react-intl';
import {trackEvent} from 'actions/telemetry_actions';

import InviteMembersLink from './invite_members_link';

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),
}));

describe('components/preparing-workspace/invite_members_link', () => {
    const inviteURL = 'https://invite-url.mattermost.com';

    it('should match snapshot', () => {
        const wrapper = shallow(<InviteMembersLink inviteURL={inviteURL}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('renders an input field with the invite URL', () => {
        const wrapper = shallow(<InviteMembersLink inviteURL={inviteURL}/>);
        const input = wrapper.find('.InviteMembersLink__input');
        expect(input).toHaveLength(1);
        expect(input.prop('value')).toEqual(inviteURL);
    });

    it('renders a button to copy the invite URL', () => {
        const wrapper = shallow(<InviteMembersLink inviteURL={inviteURL}/>);
        const button = wrapper.find('.InviteMembersLink__button');
        expect(button).toHaveLength(1);
    });

    it('calls the trackEvent function when the copy button is clicked', () => {
        const wrapper = shallow(
            <InviteMembersLink inviteURL={inviteURL}/>,
            {disableLifecycleMethods: true}, // disable componentDidMount so that useCopyText does not run
        );
        const button = wrapper.find('.InviteMembersLink__button');
        button.simulate('click');
        expect(trackEvent).toHaveBeenCalledWith('first_admin_setup', 'admin_setup_click_copy_invite_link');
    });

    it('changes the button text to "Link Copied" when the URL is copied', () => {
        const wrapper = shallow(<InviteMembersLink inviteURL={inviteURL}/>);
        let button = wrapper.find('.InviteMembersLink__button');
        const originalText = 'Copy Link';
        const linkCopiedText = 'Link Copied';
        expect(button.find(FormattedMessage).props().defaultMessage).toEqual(originalText);

        button.simulate('click');
        wrapper.update();
        button = wrapper.find('.InviteMembersLink__button');
        const defaultMessage = button.find(FormattedMessage).props().defaultMessage;
        expect(defaultMessage).not.toEqual(originalText);
        expect(defaultMessage).toEqual(linkCopiedText);
        expect(button.find('i.icon-check')).toHaveLength(1);
    });
});
