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
        IsGovSku: 'false',
    };

    const props = {
        isTrialLicense: false,
        license,
    } as EnterpriseEditionProps;

    test('should render for no Gov no Trial no Enterprise', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel {...props}/>
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Upgrade to the Enterprise Plan');

        const subtitleList = wrapper.find('.upgrade-subtitle').find('.item');
        expect(subtitleList.at(0).text()).toEqual('AD/LDAP Group sync');
        expect(subtitleList.at(1).text()).toEqual('High Availability');
        expect(subtitleList.at(2).text()).toEqual('Advanced compliance');
        expect(subtitleList.at(3).text()).toEqual('Advanced roles and permissions');
        expect(subtitleList.at(4).text()).toEqual('And more...');
    });

    test('should render for Gov no Trial no Enterprise', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={{...props.license, IsGovSku: 'true'}}
                    isTrialLicense={props.isTrialLicense}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Upgrade to the Enterprise Gov Plan');

        const subtitleList = wrapper.find('.upgrade-subtitle').find('.item');
        expect(subtitleList.at(0).text()).toEqual('AD/LDAP Group sync');
        expect(subtitleList.at(1).text()).toEqual('High Availability');
        expect(subtitleList.at(2).text()).toEqual('Advanced compliance');
        expect(subtitleList.at(3).text()).toEqual('Advanced roles and permissions');
        expect(subtitleList.at(4).text()).toEqual('And more...');
    });

    test('should render for Enterprise no Trial', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={{...props.license, SkuShortName: LicenseSkus.Enterprise}}
                    isTrialLicense={props.isTrialLicense}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Need to increase your headcount?');
        expect(wrapper.find('.upgrade-subtitle').text()).toEqual('We’re here to work with you and your needs. Contact us today to get more seats on your plan.');
    });

    test('should render for E20 no Trial', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={{...props.license, SkuShortName: LicenseSkus.E20}}
                    isTrialLicense={props.isTrialLicense}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Need to increase your headcount?');
        expect(wrapper.find('.upgrade-subtitle').text()).toEqual('We’re here to work with you and your needs. Contact us today to get more seats on your plan.');
    });

    test('should render for Trial no Gov', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={props.license}
                    isTrialLicense={true}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Purchase the Enterprise Plan');
        expect(wrapper.find('.upgrade-subtitle').text()).toEqual('Continue your access to Enterprise features by purchasing a license today.');
    });

    test('should render for Trial Gov', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionRightPanel
                    license={{...props.license, IsGovSku: 'true'}}
                    isTrialLicense={true}
                />
            </Provider>,
        );

        expect(wrapper.find('.upgrade-title').text()).toEqual('Purchase the Enterprise Gov Plan');
        expect(wrapper.find('.upgrade-subtitle').text()).toEqual('Continue your access to Enterprise features by purchasing a license today.');
    });
});
