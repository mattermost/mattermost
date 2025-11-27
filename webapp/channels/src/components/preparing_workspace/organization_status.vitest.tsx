// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';
import {BadUrlReasons} from 'utils/url';

import OrganizationStatus, {TeamApiError} from './organization_status';

describe('components/preparing-workspace/organization_status', () => {
    const defaultProps = {
        error: null,
    };

    test('should match snapshot', () => {
        const {container} = renderWithIntl(<OrganizationStatus {...defaultProps}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should render no error message when error prop is null', () => {
        const {queryByText, container} = renderWithIntl(<OrganizationStatus {...defaultProps}/>);
        expect((container.getElementsByClassName('Organization__status').length)).toBe(1);
        expect(queryByText(/empty/i)).not.toBeInTheDocument();
        expect(queryByText(/team api error/i)).not.toBeInTheDocument();
        expect(queryByText(/length/i)).not.toBeInTheDocument();
        expect(queryByText(/reserved/i)).not.toBeInTheDocument();
    });

    test('should render an error message for an empty organization name', () => {
        const {getByText} = renderWithIntl(<OrganizationStatus error={BadUrlReasons.Empty}/>);
        expect(getByText(/You must enter an organization name/i)).toBeInTheDocument();
    });

    test('should render an error message for a team API error', () => {
        const {getByText} = renderWithIntl(<OrganizationStatus error={TeamApiError}/>);
        expect(getByText(/There was an error, please try again/i)).toBeInTheDocument();
    });

    test('should render an error message for an organization name with invalid length', () => {
        const {getByText} = renderWithIntl(<OrganizationStatus error={BadUrlReasons.Length}/>);
        expect(getByText(/Organization name must be between 2 and 64 characters/i)).toBeInTheDocument();
    });
});
