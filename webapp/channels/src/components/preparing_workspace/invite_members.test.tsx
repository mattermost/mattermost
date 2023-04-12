// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {shallow} from 'enzyme';
import {FormattedMessage} from 'react-intl';
import {CSSTransition} from 'react-transition-group';
import InviteMembers from './invite_members';

describe('InviteMembers component', () => {
    let defaultProps: ComponentProps<any>;

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
            show: true,
            transitionDirection: 'forward',
        };
    });

    it('should match snapshot', () => {
        const wrapper = shallow(<InviteMembers {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('renders invite URL', () => {
        const wrapper = shallow(<InviteMembers {...defaultProps}/>);
        const inviteLink = wrapper.find('InviteMembersLink');
        expect(inviteLink.prop('inviteURL')).toEqual('https://my-org.mattermost.com/config/signup_user_complete/?id=1234');
    });

    it('renders submit button with correct text', () => {
        const wrapper = shallow(<InviteMembers {...defaultProps}/>);
        const button = wrapper.find('button.primary-button');
        const formattedMessage = button.find(FormattedMessage);

        expect(formattedMessage.props().defaultMessage).toEqual('Finish setup');
    });

    it('button is disabled when disableEdits is true', () => {
        const wrapper = shallow(
            <InviteMembers
                {...defaultProps}
                disableEdits={true}
            />);
        const button = wrapper.find('button.primary-button');
        expect(button.prop('disabled')).toBe(true);
    });

    it('invokes next prop on button click', () => {
        const wrapper = shallow(<InviteMembers {...defaultProps}/>);
        const button = wrapper.find('button.primary-button');
        button.simulate('click');
        expect(defaultProps.next).toHaveBeenCalled();
    });

    it('renders CSS transition', () => {
        const wrapper = shallow(<InviteMembers {...defaultProps}/>);
        const cssTransition = wrapper.find(CSSTransition);
        expect(cssTransition.prop('in')).toBe(true);
        expect(cssTransition.prop('timeout')).toBe(300);
        expect(cssTransition.prop('classNames')).toBe('InviteMembers--enter-from-before');
        expect(cssTransition.prop('mountOnEnter')).toBe(true);
        expect(cssTransition.prop('unmountOnExit')).toBe(true);
    });
});
