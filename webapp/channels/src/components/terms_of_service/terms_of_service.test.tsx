// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import type EmojiMap from 'utils/emoji_map';

import TermsOfService from './terms_of_service';
import type {TermsOfServiceProps} from './terms_of_service';

jest.mock('actions/global_actions', () => ({
    emitUserLoggedOutEvent: jest.fn(),
    redirectUserToDefaultTeam: jest.fn(),
}));

describe('components/terms_of_service/TermsOfService', () => {
    const getTermsOfService = jest.fn().mockResolvedValue({data: {id: 'tos_id', text: 'tos_text'}});
    const updateMyTermsOfServiceStatus = jest.fn().mockResolvedValue({data: true});

    const baseProps: TermsOfServiceProps = {
        actions: {
            getTermsOfService,
            updateMyTermsOfServiceStatus,
        },
        location: {search: ''},
        termsEnabled: true,
        emojiMap: {} as EmojiMap,
        onboardingFlowEnabled: false,
    };

    test('should match snapshot', () => {
        const props = {...baseProps};
        const wrapper = shallow<TermsOfService>(<TermsOfService {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call getTermsOfService on mount', () => {
        const props = {...baseProps};
        shallow<TermsOfService>(<TermsOfService {...props}/>);
        expect(props.actions.getTermsOfService).toHaveBeenCalledTimes(1);
    });

    test('should match snapshot on loading', () => {
        const props = {...baseProps};
        const wrapper = shallow<TermsOfService>(<TermsOfService {...props}/>);
        wrapper.setState({loading: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on accept terms', () => {
        const props = {...baseProps};
        const wrapper = shallow<TermsOfService>(<TermsOfService {...props}/>);
        wrapper.setState({loadingAgree: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on reject terms', () => {
        const props = {...baseProps};
        const wrapper = shallow<TermsOfService>(<TermsOfService {...props}/>);
        wrapper.setState({loadingDisagree: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call updateTermsOfServiceStatus on registerUserAction', async () => {
        const wrapper = shallow<TermsOfService>(<TermsOfService {...baseProps}/>);
        await wrapper.instance().registerUserAction(true, jest.fn());
        expect(baseProps.actions.updateMyTermsOfServiceStatus).toHaveBeenCalledTimes(1);
    });

    test('should match state and call updateTermsOfServiceStatus on handleAcceptTerms', () => {
        const wrapper = shallow<TermsOfService>(<TermsOfService {...baseProps}/>);
        wrapper.instance().handleAcceptTerms();
        expect(wrapper.state('loadingAgree')).toEqual(true);
        expect(wrapper.state('serverError')).toEqual(null);
        expect(baseProps.actions.updateMyTermsOfServiceStatus).toHaveBeenCalledTimes(1);
    });

    test('should match state and call updateTermsOfServiceStatus on handleRejectTerms', () => {
        const wrapper = shallow<TermsOfService>(<TermsOfService {...baseProps}/>);
        wrapper.instance().handleRejectTerms();
        expect(wrapper.state('loadingDisagree')).toEqual(true);
        expect(wrapper.state('serverError')).toEqual(null);
        expect(baseProps.actions.updateMyTermsOfServiceStatus).toHaveBeenCalledTimes(1);
    });

    test('should call emitUserLoggedOutEvent on handleLogoutClick', () => {
        const wrapper = shallow<TermsOfService>(<TermsOfService {...baseProps}/>);
        wrapper.instance().handleLogoutClick({preventDefault: jest.fn()} as unknown as React.MouseEvent<HTMLAnchorElement, MouseEvent>);
        expect(emitUserLoggedOutEvent).toHaveBeenCalledTimes(1);
        expect(emitUserLoggedOutEvent).toHaveBeenCalledWith('/login');
    });
});
