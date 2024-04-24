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
});
