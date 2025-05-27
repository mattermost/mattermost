// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
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
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={{...props.license, SkuShortName: LicenseSkus.Professional}}
                    isTrialLicense={props.isTrialLicense}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Upgrade to Enterprise');

        const subtitleList = wrapper.find('.upgrade-subtitle').find('.item');
        expect(subtitleList.at(0).text()).toEqual('AD/LDAP Group sync');
        expect(subtitleList.at(1).text()).toEqual('High Availability');
        expect(subtitleList.at(2).text()).toEqual('Advanced compliance');
        expect(subtitleList.at(3).text()).toEqual('Advanced roles and permissions');
        expect(subtitleList.at(4).text()).toEqual('And more...');
    });

    test('should render for Enterprise license', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={{...props.license, SkuShortName: LicenseSkus.Enterprise}}
                    isTrialLicense={props.isTrialLicense}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Upgrade to Enterprise Advanced');

        const subtitleList = wrapper.find('.upgrade-subtitle').find('.item');
        expect(subtitleList.at(0).text()).toEqual('Attribute-based access control');
        expect(subtitleList.at(1).text()).toEqual('Channel warning banners');
        expect(subtitleList.at(2).text()).toEqual('AD/LDAP group sync');
        expect(subtitleList.at(3).text()).toEqual('Advanced workflows with Playbooks');
        expect(subtitleList.at(4).text()).toEqual('High availability');
        expect(subtitleList.at(5).text()).toEqual('Advanced compliance');
        expect(subtitleList.at(6).text()).toEqual('And more...');
    });

    test('should render for Enterprise Advanced license', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={{...props.license, SkuShortName: LicenseSkus.EnterpriseAdvanced}}
                    isTrialLicense={props.isTrialLicense}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Need to increase your headcount?');
        expect(wrapper.find('.upgrade-subtitle').text()).toEqual('We’re here to work with you and your needs. Contact us today to get more seats on your plan.');
    });

    test('should render for Trial license', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={props.license}
                    isTrialLicense={true}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Purchase Enterprise Advanced');
        expect(wrapper.find('.upgrade-subtitle').text()).toEqual('Continue your access to Enterprise Advanced features by purchasing a license.');
    });
});
