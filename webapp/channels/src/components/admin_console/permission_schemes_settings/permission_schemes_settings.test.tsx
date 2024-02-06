// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import type {RouteComponentProps} from 'react-router-dom';

import type {Scheme} from '@mattermost/types/schemes';

import PermissionSchemesSettings from 'components/admin_console/permission_schemes_settings/permission_schemes_settings';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

describe('components/admin_console/permission_schemes_settings/permission_schemes_settings', () => {
    const defaultProps: ComponentProps<typeof PermissionSchemesSettings> = {
        schemes: {
            'id-1': {id: 'id-1', name: 'Test 1', description: 'Test description 1'} as Scheme,
            'id-2': {id: 'id-2', name: 'Test 2', description: 'Test description 2'} as Scheme,
            'id-3': {id: 'id-3', name: 'Test 3', description: 'Test description 3'} as Scheme,
        },
        jobsAreEnabled: true,
        clusterIsEnabled: false,
        actions: {
            loadSchemes: jest.fn(() => Promise.resolve({})),
            loadSchemeTeams: jest.fn(),
        },
        license: {
            CustomPermissionsSchemes: 'true',
            SkuShortName: '',
        },
        ...{} as RouteComponentProps,
    };

    test('should match snapshot loading', () => {
        const wrapper = shallowWithIntl(
            <PermissionSchemesSettings {...defaultProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot without schemes', () => {
        const wrapper = shallowWithIntl(
            <PermissionSchemesSettings
                {...defaultProps}
                schemes={{}}
            />,
        );
        wrapper.setState({loading: false, phase2MigrationIsComplete: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with schemes', () => {
        const wrapper = shallowWithIntl(
            <PermissionSchemesSettings {...defaultProps}/>,
        );
        wrapper.setState({loading: false, phase2MigrationIsComplete: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should show migration in-progress view', () => {
        const wrapper = shallowWithIntl(
            <PermissionSchemesSettings {...defaultProps}/>,
        );
        wrapper.setState({loading: false, phase2MigrationIsComplete: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should show migration on hold view', () => {
        const testProps = {...defaultProps};
        testProps.jobsAreEnabled = false;
        const wrapper = shallowWithIntl(
            <PermissionSchemesSettings {...testProps}/>,
        );
        wrapper.setState({loading: false, phase2MigrationIsComplete: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should show normal view (jobs disabled after migration)', () => {
        const testProps = {...defaultProps};
        testProps.jobsAreEnabled = false;
        const wrapper = shallowWithIntl(
            <PermissionSchemesSettings {...testProps}/>,
        );
        wrapper.setState({loading: false, phase2MigrationIsComplete: true});
        expect(wrapper).toMatchSnapshot();
    });
});
