// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// import React from 'react';
// import {shallow} from 'enzyme';
// import {FormattedMessage} from 'react-intl';
// import Constants from 'utils/constants';
// import {BadUrlReasons} from 'utils/url';
// import OrganizationStatus, {TeamApiError} from './organization_status';

// describe('components/preparing-workspace/organization_status', () => {
//     const defaultProps = {
//         error: null,
//     };


//     it('should render no error message when error prop is null', () => {
//         const wrapper = shallow(<OrganizationStatus {...defaultProps}/>);
//         expect(wrapper.find('.Organization__status')).toHaveLength(1);
//         expect(wrapper.find(FormattedMessage)).toHaveLength(0);
//     });

//     it('should render an error message for an empty organization name', () => {
//         const wrapper = shallow(<OrganizationStatus error={BadUrlReasons.Empty}/>);
//         expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
//         const formattedMessage = wrapper.find(FormattedMessage);
//         expect(formattedMessage).toHaveLength(1);
//         expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.empty');
//     });

//     it('should render an error message for a team API error', () => {
//         const wrapper = shallow(<OrganizationStatus error={TeamApiError}/>);
//         expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
//         const formattedMessage = wrapper.find(FormattedMessage);
//         expect(formattedMessage).toHaveLength(1);
//         expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.team_api_error');
//     });

//     it('should render an error message for an organization name with invalid length', () => {
//         const wrapper = shallow(<OrganizationStatus error={BadUrlReasons.Length}/>);
//         expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
//         const formattedMessage = wrapper.find(FormattedMessage);
//         expect(formattedMessage).toHaveLength(1);
//         expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.length');
//         expect(formattedMessage.props().values?.min).toEqual(Constants.MIN_TEAMNAME_LENGTH);
//         expect(formattedMessage.props().values?.max).toEqual(Constants.MAX_TEAMNAME_LENGTH);
//     });

//     it('should render an error message for an organization name that starts with a reserved word', () => {
//         const wrapper = shallow(<OrganizationStatus error={BadUrlReasons.Reserved}/>);
//         expect(wrapper.find('.Organization__status--error')).toHaveLength(1);
//         const formattedMessage = wrapper.find(FormattedMessage);
//         expect(formattedMessage).toHaveLength(1);
//         expect(formattedMessage.props().id).toEqual('onboarding_wizard.organization.reserved');
//     });
// });

import React from 'react';
import {render} from '@testing-library/react';
import Constants from 'utils/constants';
import {BadUrlReasons} from 'utils/url';
import OrganizationStatus, {TeamApiError} from './organization_status';
import {withIntl} from 'tests/helpers/intl-test-helper';

describe('components/preparing-workspace/organization_status', () => {
    const defaultProps = {
        error: null,
    };

    it('should match snapshot', () => {
        const {container} = render(<OrganizationStatus {...defaultProps}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it('should render no error message when error prop is null', () => {
        const {queryByText, container} = render(<OrganizationStatus {...defaultProps}/>);
        expect((container.getElementsByClassName('Organization__status').length)).toBe(1);
        expect(queryByText(/empty/i)).not.toBeInTheDocument();
        expect(queryByText(/team api error/i)).not.toBeInTheDocument();
        expect(queryByText(/length/i)).not.toBeInTheDocument();
        expect(queryByText(/reserved/i)).not.toBeInTheDocument();
    });

    it('should render an error message for an empty organization name', () => {
        const component = withIntl(<OrganizationStatus error={BadUrlReasons.Empty}/>);
        const {getByText} = render(component);
        expect(getByText(/You must enter an organization name/i)).toBeInTheDocument();
    });

    it('should render an error message for a team API error', () => {
        const component = withIntl(<OrganizationStatus error={TeamApiError}/>);
        const {getByText} = render(component);
        expect(getByText(/There was an error, please try again/i)).toBeInTheDocument();
    });

    it.only('should render an error message for an organization name with invalid length', () => {
        const component = withIntl(<OrganizationStatus error={BadUrlReasons.Length}/>);
        const {getByText} = render(component);
        expect(getByText(/length/i)).toBeInTheDocument();
        expect(getByText('onboarding_wizard.organization.length')).toBeInTheDocument();
        expect(getByText(`min=${Constants.MIN_TEAMNAME_LENGTH}`)).toBeInTheDocument();
        expect(getByText(`max=${Constants.MAX_TEAMNAME_LENGTH}`)).toBeInTheDocument();
    });

    it('should render an error message for an organization name that starts with a reserved word', () => {
        const {getByText} = render(<OrganizationStatus error={BadUrlReasons.Reserved}/>);
        expect(getByText(/reserved/i)).toBeInTheDocument();
        expect(getByText('onboarding_wizard.organization.reserved')).toBeInTheDocument();
    });
});
