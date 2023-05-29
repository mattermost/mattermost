// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
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

    it('should render an error message for an organization name with invalid length', () => {
        const component = withIntl(<OrganizationStatus error={BadUrlReasons.Length}/>);
        const {getByText} = render(component);
        expect(getByText(/Organization name must be between 2 and 64 characters/i)).toBeInTheDocument();
    });
});
