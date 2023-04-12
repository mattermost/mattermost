// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {FormattedMessage} from 'react-intl';
import Constants from 'utils/constants';
import {BadUrlReasons} from 'utils/url';
import OrganizationStatus, {TeamApiError} from './organization_status';

describe('components/preparing-workspace/organization_status', () => {
    const defaultProps = {
        error: null,
    };

    it('should match snapshot', () => {
        const wrapper = shallow(<OrganizationStatus{...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should render no error message when error prop is null', () => {
        const wrapper = shallow(<OrganizationStatus {...defaultProps}/>);
        expect(wrapper.find('.Organization__status')).toHaveLength(1);
        expect(wrapper.find(FormattedMessage)).toHaveLength(0);
    });

    it('should render an error message for an empty organization name', () => {
        const wrapper = shallow(<OrganizationStatus error={BadUrlReasons.Empty}/>);
        expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
        const formattedMessage = wrapper.find(FormattedMessage);
        expect(formattedMessage).toHaveLength(1);
        expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.empty');
    });

    it('should render an error message for a team API error', () => {
        const wrapper = shallow(<OrganizationStatus error={TeamApiError}/>);
        expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
        const formattedMessage = wrapper.find(FormattedMessage);
        expect(formattedMessage).toHaveLength(1);
        expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.team_api_error');
    });

    it('should render an error message for an organization name with invalid length', () => {
        const wrapper = shallow(<OrganizationStatus error={BadUrlReasons.Length}/>);
        expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
        const formattedMessage = wrapper.find(FormattedMessage);
        expect(formattedMessage).toHaveLength(1);
        expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.length');
        expect(formattedMessage.props().values?.min).toEqual(Constants.MIN_TEAMNAME_LENGTH);
        expect(formattedMessage.props().values?.max).toEqual(Constants.MAX_TEAMNAME_LENGTH);
    });

    it('should render an error message for an organization name that starts with a reserved word', () => {
        const wrapper = shallow(<OrganizationStatus error={BadUrlReasons.Reserved}/>);
        expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
        const formattedMessage = wrapper.find(FormattedMessage);
        expect(formattedMessage).toHaveLength(1);
        expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.reserved');
    });
});
