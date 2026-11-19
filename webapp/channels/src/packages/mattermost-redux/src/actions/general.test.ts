// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/general';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.General', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        Actions.resetClientConfigOverridesSyncState();
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('getClientConfig', async () => {
        nock(Client4.getBaseRoute()).
            get('/config/client').
            query(true).
            reply(200, {Version: '4.0.0', BuildNumber: '3', BuildDate: 'Yesterday', BuildHash: '1234'});

        await store.dispatch(Actions.getClientConfig());

        const clientConfig = store.getState().entities.general.config;

        // Check a few basic fields since they may change over time
        expect(clientConfig.Version).toBeTruthy();
        expect(clientConfig.BuildNumber).toBeTruthy();
        expect(clientConfig.BuildDate).toBeTruthy();
        expect(clientConfig.BuildHash).toBeTruthy();
    });

    it('getLicenseConfig', async () => {
        nock(Client4.getBaseRoute()).
            get('/license/client').
            query(true).
            reply(200, {IsLicensed: 'false'});

        await store.dispatch(Actions.getLicenseConfig());

        const licenseConfig = store.getState().entities.general.license;

        // Check a few basic fields since they may change over time
        expect(licenseConfig.IsLicensed).not.toEqual(undefined);
    });

    it('setServerVersion', async () => {
        const version = '3.7.0';
        await store.dispatch(Actions.setServerVersion(version));
        await TestHelper.wait(100);
        const {serverVersion} = store.getState().entities.general;
        expect(serverVersion).toEqual(version);
    });

    it('setFirstAdminVisitMarketplaceStatus', async () => {
        nock(Client4.getPluginsRoute()).
            post('/marketplace/first_admin_visit').
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.setFirstAdminVisitMarketplaceStatus());

        const {firstAdminVisitMarketplaceStatus} = store.getState().entities.general;
        expect(firstAdminVisitMarketplaceStatus).toEqual(true);
    });

    it('getCustomProfileAttributes', async () => {
        nock(Client4.getCustomProfileAttributeFieldsRoute()).
            get('').
            query(true).
            reply(200, [{id: '123', name: 'test attribute', dataType: 'text'}]);

        await store.dispatch(Actions.getCustomProfileAttributeFields());

        const customProfileAttributes = store.getState().entities.general.customProfileAttributes;

        // Check a few basic fields since they may change over time
        expect(Object.keys(customProfileAttributes).length).toEqual(1);
        expect(customProfileAttributes[123].id).toEqual('123');
        expect(customProfileAttributes[123].name).toEqual('test attribute');
        expect(customProfileAttributes[123].dataType).toEqual('text');
    });

    describe('getClientConfigOverrides', () => {
        it('fetches overrides and coalesces concurrent in-flight requests', async () => {
            let calls = 0;
            nock(Client4.getBaseRoute()).
                get('/config/client/overrides').
                reply(200, () => {
                    calls += 1;
                    return {MobileEnableBiometrics: 'true'};
                });

            const [res1, res2] = await Promise.all([
                store.dispatch(Actions.getClientConfigOverrides()),
                store.dispatch(Actions.getClientConfigOverrides()),
            ]);

            expect(calls).toBe(1);
            expect(res1.data).toEqual({MobileEnableBiometrics: 'true'});
            expect(res2.data).toEqual({MobileEnableBiometrics: 'true'});
            expect(store.getState().entities.general.clientConfigOverrides).toEqual({MobileEnableBiometrics: 'true'});
        });

        it('discards stale in-flight completion when receivedClientConfigOverrides arrives first', async () => {
            let resolveFetch: ((val: {MobileEnableBiometrics: string}) => void) | undefined;
            const spy = jest.spyOn(Client4, 'getClientConfigOverrides').mockImplementationOnce(
                () => new Promise((resolve) => {
                    resolveFetch = resolve;
                }),
            );

            try {
                const inFlight = store.dispatch(Actions.getClientConfigOverrides());
                store.dispatch(Actions.receivedClientConfigOverrides({MobileEnableBiometrics: 'true'}));

                resolveFetch?.({MobileEnableBiometrics: 'false'});
                await inFlight;

                expect(store.getState().entities.general.clientConfigOverrides).toEqual({MobileEnableBiometrics: 'true'});
            } finally {
                spy.mockRestore();
            }
        });
    });
});
