// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import EnterpriseEditionRightPanel from './enterprise_edition_right_panel';
import type {EnterpriseEditionProps} from './enterprise_edition_right_panel';

const initialState = {
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

        expect(container.querySelector('.upgrade-title')?.textContent).toEqual('Upgrade to Enterprise');

        const subtitleItems = container.querySelectorAll('.upgrade-subtitle .item');
        expect(subtitleItems[0].textContent).toEqual('AD/LDAP Group sync');
        expect(subtitleItems[1].textContent).toEqual('High Availability');
        expect(subtitleItems[2].textContent).toEqual('Advanced compliance');
        expect(subtitleItems[3].textContent).toEqual('Advanced roles and permissions');
        expect(subtitleItems[4].textContent).toEqual('And more...');
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
        expect(subtitleItems[0].textContent).toEqual('Dynamic attribute-based access controls');
        expect(subtitleItems[1].textContent).toEqual('Data spillage handling');
        expect(subtitleItems[2].textContent).toEqual('Burn-on-read messages');
        expect(subtitleItems[3].textContent).toEqual('Mobile biometrics & advanced security');
        expect(subtitleItems[4].textContent).toEqual('Automatic channel translations');
        expect(subtitleItems[5].textContent).toEqual('Channel banners');
        expect(subtitleItems[6].textContent).toEqual('And more...');
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
        expect(container.querySelector('.upgrade-subtitle')?.textContent).toEqual("We're here to work with you and your needs. Contact us today to get more seats on your plan.");
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
        expect(screen.getByRole('button', {name: 'Questions? Contact sales'})).toBeInTheDocument();
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
