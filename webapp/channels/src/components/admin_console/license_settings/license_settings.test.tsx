// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import expect from 'expect';
import moment from 'moment';
import React from 'react';

import {fakeDate} from 'tests/helpers/date';
import {LicenseSkus} from 'utils/constants';

import LicenseSettings from './license_settings';

import type {ComponentProps} from 'react';

const flushPromises = () => new Promise(setImmediate);

describe('components/admin_console/license_settings/LicenseSettings', () => {
    let resetFakeDate: {(): void};

    beforeAll(() => {
        resetFakeDate = fakeDate(new Date('2021-04-14T12:00:00Z'));
    });

    afterAll(() => {
        resetFakeDate();
    });

    const defaultProps: ComponentProps<typeof LicenseSettings> = {
        isDisabled: false,
        license: {
            IsLicensed: 'true',
            IssuedAt: '1517714643650',
            StartsAt: '1517714643650',
            ExpiresAt: '1620335443650',
            SkuShortName: LicenseSkus.E20,
            Name: 'LicenseName',
            Company: 'Mattermost Inc.',
            Users: '100',
        },
        prevTrialLicense: {
            IsLicensed: 'false',
        },
        upgradedFromTE: false,
        enterpriseReady: true,
        totalUsers: 10,
        actions: {
            getLicenseConfig: jest.fn(),
            uploadLicense: jest.fn(),
            removeLicense: jest.fn(),
            upgradeToE0: jest.fn(),
            ping: jest.fn(),
            requestTrialLicense: jest.fn(),
            restartServer: jest.fn(),
            getPrevTrialLicense: jest.fn(),
            upgradeToE0Status: jest.fn().mockImplementation(() => Promise.resolve({percentage: 0, error: null})),
            openModal: jest.fn(),
            getFilteredUsersStats: jest.fn(),
        },
    };

    test('should match snapshot enterprise build with license', () => {
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with license and isDisabled set to true', () => {
        const wrapper = shallow<LicenseSettings>(
            <LicenseSettings
                {...defaultProps}
                isDisabled={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with license and upgraded from TE', () => {
        const props = {...defaultProps, upgradedFromTE: true};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build without license', () => {
        const props = {...defaultProps, license: {IsLicensed: 'false'}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build without license and upgrade from TE', () => {
        const props = {...defaultProps, license: {IsLicensed: 'false'}, upgradedFromTE: true};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot team edition build without license', () => {
        const props = {...defaultProps, enterpriseReady: false, license: {IsLicensed: 'false'}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot team edition build with license', () => {
        const props = {...defaultProps, enterpriseReady: false};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('upgrade to enterprise click', async () => {
        const actions = {
            ...defaultProps.actions,
            getLicenseConfig: jest.fn(),
            upgradeToE0: jest.fn(),
            upgradeToE0Status: jest.fn().mockImplementation(() => Promise.resolve({percentage: 0, error: null})),
        };
        const props = {...defaultProps, enterpriseReady: false, actions};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);

        expect(actions.getLicenseConfig).toBeCalledTimes(1);
        expect(actions.upgradeToE0Status).toBeCalledTimes(1);
        actions.upgradeToE0Status = jest.fn().mockImplementation(() => Promise.resolve({percentage: 1, error: null}));

        const instance = wrapper.instance();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        expect(instance.interval).toBe(null);
        expect(wrapper.state('upgradingPercentage')).toBe(0);

        await instance.handleUpgrade({preventDefault: jest.fn()} as unknown as React.MouseEvent<HTMLButtonElement>);
        expect(actions.upgradeToE0).toBeCalledTimes(1);
        expect(actions.upgradeToE0Status).toBeCalledTimes(1);
        wrapper.update();
        expect(wrapper.update().state('upgradingPercentage')).toBe(1);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        expect(instance.interval).not.toBe(null);
    });

    test('load screen while upgrading', async () => {
        const actions = {
            ...defaultProps.actions,
            upgradeToE0Status: jest.fn().mockImplementation(() => Promise.resolve({percentage: 42, error: null})),
        };
        const props = {...defaultProps, enterpriseReady: false, actions};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        await flushPromises();
        expect(wrapper).toMatchSnapshot();
    });

    test('load screen after upgrading', async () => {
        const actions = {
            ...defaultProps.actions,
            upgradeToE0Status: jest.fn().mockImplementation(() => Promise.resolve({percentage: 100, error: null})),
        };
        const props = {...defaultProps, enterpriseReady: false, actions};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        await flushPromises();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with trial license', () => {
        const props = {...defaultProps, license: {IsLicensed: 'true', StartsAt: '1617714643650', IssuedAt: '1617714643650', ExpiresAt: '1620335443650'}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot team edition with expired trial in the past', () => {
        const props = {...defaultProps, license: {IsLicensed: 'false'}, prevTrialLicense: {IsLicensed: 'true'}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with E20 license', () => {
        const props = {...defaultProps, license: {...defaultProps.license, SkuShortName: LicenseSkus.E20}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with E10 license', () => {
        const props = {...defaultProps, license: {...defaultProps.license, SkuShortName: LicenseSkus.E10}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot enterprise build with Enterprise license', () => {
        const props = {...defaultProps, license: {...defaultProps.license, SkuShortName: LicenseSkus.Enterprise}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with expiring license', () => {
        // Set expiration date to 30 days from today
        const expiringDate = moment().add(30, 'days').valueOf();

        const props = {...defaultProps, license: {...defaultProps.license, ExpiresAt: expiringDate.toString()}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with cloud expiring license', () => {
        // Set expiration date to 30 days from today
        const expiringDate = moment().add(30, 'days').valueOf();

        const props = {...defaultProps, license: {...defaultProps.license, ExpiresAt: expiringDate.toString(), Cloud: 'true'}};
        const wrapper = shallow<LicenseSettings>(<LicenseSettings {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
