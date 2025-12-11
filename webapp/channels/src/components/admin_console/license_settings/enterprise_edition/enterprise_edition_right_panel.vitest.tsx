// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import type {GlobalState} from 'types/store';

import EnterpriseEditionRightPanel from './enterprise_edition_right_panel';
import type {EnterpriseEditionProps} from './enterprise_edition_right_panel';

describe('components/admin_console/license_settings/enterprise_edition/enterprise_edition_right_panel', () => {
    const license = {
        IsLicensed: 'true',
        IssuedAt: '1517714643650',
        StartsAt: '1517714643650',
        ExpiresAt: '1620335443650',
        SkuShortName: LicenseSkus.Starter,
        Name: 'LicenseName',
        Company: 'Mattermost Inc.',
        Users: '1000000',
    };

    const initialState: DeepPartial<GlobalState> = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
        entities: {
            general: {
                config: {
                    CWSURL: '',
                },
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_user'},
                },
            },
            preferences: {
                myPreferences: {},
            },
            cloud: {},
        },
    };

    const props = {
        isTrialLicense: false,
        license,
    } as EnterpriseEditionProps;

    test('should render for Professional license', () => {
        const {container} = renderWithContext(
            <EnterpriseEditionRightPanel
                license={{...props.license, SkuShortName: LicenseSkus.Professional}}
                isTrialLicense={props.isTrialLicense}
            />,
            initialState,
        );

        expect(container.querySelector('.upgrade-title')?.textContent).toEqual('Upgrade to the Enterprise plan');

        const subtitleItems = container.querySelectorAll('.upgrade-subtitle .item');
        expect(subtitleItems[0]?.textContent).toEqual('AD/LDAP Group sync');
        expect(subtitleItems[1]?.textContent).toEqual('High Availability');
        expect(subtitleItems[2]?.textContent).toEqual('Advanced compliance');
        expect(subtitleItems[3]?.textContent).toEqual('Advanced roles and permissions');
        expect(subtitleItems[4]?.textContent).toEqual('And more...');
    });

    test('should render for Enterprise license', () => {
        const {container} = renderWithContext(
            <EnterpriseEditionRightPanel
                license={{...props.license, SkuShortName: LicenseSkus.Enterprise}}
                isTrialLicense={props.isTrialLicense}
            />,
            initialState,
        );

        expect(container.querySelector('.upgrade-title')?.textContent).toEqual('Upgrade to Enterprise Advanced');

        const subtitleItems = container.querySelectorAll('.upgrade-subtitle .item');
        expect(subtitleItems[0]?.textContent).toEqual('Attribute-based access control');
        expect(subtitleItems[1]?.textContent).toEqual('Channel warning banners');
        expect(subtitleItems[2]?.textContent).toEqual('AD/LDAP group sync');
        expect(subtitleItems[3]?.textContent).toEqual('Advanced workflows with Playbooks');
        expect(subtitleItems[4]?.textContent).toEqual('High availability');
        expect(subtitleItems[5]?.textContent).toEqual('Advanced compliance');
        expect(subtitleItems[6]?.textContent).toEqual('And more...');
    });

    test('should render for Enterprise Advanced license', () => {
        const {container} = renderWithContext(
            <EnterpriseEditionRightPanel
                license={{...props.license, SkuShortName: LicenseSkus.EnterpriseAdvanced}}
                isTrialLicense={props.isTrialLicense}
            />,
            initialState,
        );

        expect(container.querySelector('.upgrade-title')?.textContent).toEqual('Need to increase your headcount?');
        expect(container.querySelector('.upgrade-subtitle')?.textContent).toEqual('We’re here to work with you and your needs. Contact us today to get more seats on your plan.');
    });

    test('should render for Entry license', () => {
        const {container} = renderWithContext(
            <EnterpriseEditionRightPanel
                license={{...props.license, SkuShortName: LicenseSkus.Entry}}
                isTrialLicense={props.isTrialLicense}
            />,
            initialState,
        );

        expect(container.querySelector('.upgrade-title')?.textContent).toEqual('Get access to full message history, AI-powered coordination, and secure workflow continuity');
        expect(container.querySelector('.upgrade-subtitle')?.textContent).toEqual('Purchase a plan to unlock full access, or start a trial to remove limits while you evaluate Enterprise Advanced.');

        // Check for the Contact sales button
        const contactSalesBtn = screen.getByRole('button', {name: /Questions\? Contact sales/i});
        expect(contactSalesBtn).toBeInTheDocument();
    });

    test('should render for Trial license', () => {
        const {container} = renderWithContext(
            <EnterpriseEditionRightPanel
                license={props.license}
                isTrialLicense={true}
            />,
            initialState,
        );

        expect(container.querySelector('.upgrade-title')?.textContent).toEqual('Purchase Enterprise Advanced');
        expect(container.querySelector('.upgrade-subtitle')?.textContent).toEqual('Continue your access to Enterprise Advanced features by purchasing a license.');
    });
});
