// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import * as Actions from 'mattermost-redux/actions/admin';
import {Client4} from 'mattermost-redux/client';

import {RequestStatus, Stats} from '../constants';
import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';
import {ActionResult} from 'mattermost-redux/types/actions';
import {CreateDataRetentionCustomPolicy} from '@mattermost/types/data_retention';

const OK_RESPONSE = {status: 'OK'};
const NO_GROUPS_RESPONSE = {count: 0, groups: []};

const samlIdpURL = 'http://idpurl';
const samlIdpDescriptorURL = 'http://idpdescriptorurl';
const samlIdpPublicCertificateText = 'MIIC4jCCAcqgAwIBAgIQE9soWni/eL9ChsWeJCEKNDANBgkqhkiG9w0BAQsFADAtMSswKQYDVQQDEyJBREZTIFNpZ25pbmcgLSBhZGZzLnBhcm5hc2FkZXYuY29tMB4XDTE2MDcwMTE1MDgwN1oXDTE3MDcwMTE1MDgwN1owLTErMCkGA1UEAxMiQURGUyBTaWduaW5nIC0gYWRmcy5wYXJuYXNhZGV2LmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANDxoju4k5q4H6sQ5v4/4wQSgrE9+ybLnz6+HPdmGd9gAS0qVafy8P1FbciEe+cBkpConYAMdGcBjmEdFOu5OAjsBgov1GMIHaPy4SwEyfn/FDmYSjCUSm7s5pxouAMP5mRJLdApQNwGeNxQNuFCUu3aM6X29ba/twwyQVaKIf1U1HVOY2UEs/X7qKU4ECwTy3Nxt1gaMISTPwxRU+d5dHbbI+2GKqzTriJd4alMHqnbBNWuuIDggOYT/zaRnGl9DAW/F6XgloWdO6SROnXH056fTZs7O5nJ9en9F82r7NOq5rBr/KI+R9eUlJHhfr/FtCYRrnPfTuubRFF2XtmrFwECAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAhZwCiYNFO2BuLH1UWmqG9lN7Ns/GjRDOuTt0hOUPHYFy2Es5iqmEakRrnecTz5KJxrO7SguaVK+VvTtssWszFnB2kRWIF98B2yjEjXjJHO1UhqjcKwbZScmmTukWf6lqlz+5uqyqPS/rxcNsBgNIwsJCl0z44Y5XHgpgGs+DXQx39RMyAvlmPWUY5dELVxAiEzKkOXAGDeJ5wIqiT61rmPkQuGjUBb/DZiFFBYmbp7npjVOb5XBrLErndIrHYiTZuIhpwCS+J3LHAOIL3eKD4iUcyB/lZjF6py1E2h+xVbpxHF9ENKQjsLkDjzIdhP269Gh8YUoOxkG63TXq8n6a3A==';

describe('Actions.Admin', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore();

        nock.cleanAll();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('getAudits', async () => {
        nock(Client4.getBaseRoute()).
            get('/audits').
            query(true).
            reply(200, [
                {
                    id: 'z6ghakhm5brsub66cjhz9yb9za',
                    create_at: 1491331476323,
                    user_id: 'ua7yqgjiq3dabc46ianp3yfgty',
                    action: '/api/v4/teams/o5pjxhkq8br8fj6xnidt7hm3ja',
                    extra_info: '',
                    ip_address: '127.0.0.1',
                    session_id: 'u3yb6bqe6fg15bu4stzyto8rgh',
                },
            ]);

        await Actions.getAudits()(store.dispatch, store.getState);

        const state = store.getState();

        const audits = state.entities.admin.audits;
        expect(audits).toBeTruthy();
        expect(Object.keys(audits).length > 0).toBeTruthy();
    });

    it('getConfig', async () => {
        nock(Client4.getBaseRoute()).
            get('/config').
            reply(200, {
                TeamSettings: {
                    SiteName: 'Mattermost',
                },
            });

        nock(Client4.getBaseRoute()).
            get('/terms_of_service').
            reply(200, {
                create_at: 1537976679426,
                id: '1234',
                text: 'Terms of Service',
                user_id: '1',
            });

        await Actions.getConfig()(store.dispatch, store.getState);

        const state = store.getState();

        const config = state.entities.admin.config;
        expect(config).toBeTruthy();
        expect(config.TeamSettings).toBeTruthy();
        expect(config.TeamSettings.SiteName === 'Mattermost').toBeTruthy();
    });

    it('updateConfig', async () => {
        nock(Client4.getBaseRoute()).
            get('/config').
            reply(200, {
                TeamSettings: {
                    SiteName: 'Mattermost',
                },
            });

        const {data} = await Actions.getConfig()(store.dispatch, store.getState) as ActionResult;
        const updated = JSON.parse(JSON.stringify(data));
        const oldSiteName = updated.TeamSettings.SiteName;
        const testSiteName = 'MattermostReduxTest';
        updated.TeamSettings.SiteName = testSiteName;

        nock(Client4.getBaseRoute()).
            put('/config').
            reply(200, updated);

        await Actions.updateConfig(updated)(store.dispatch, store.getState);

        let state = store.getState();

        let config = state.entities.admin.config;
        expect(config).toBeTruthy();
        expect(config.TeamSettings).toBeTruthy();
        expect(config.TeamSettings.SiteName === testSiteName).toBeTruthy();

        updated.TeamSettings.SiteName = oldSiteName;

        nock(Client4.getBaseRoute()).
            put('/config').
            reply(200, updated);

        await Actions.updateConfig(updated)(store.dispatch, store.getState);

        state = store.getState();

        config = state.entities.admin.config;
        expect(config).toBeTruthy();
        expect(config.TeamSettings).toBeTruthy();
        expect(config.TeamSettings.SiteName === oldSiteName).toBeTruthy();
    });

    it('reloadConfig', async () => {
        nock(Client4.getBaseRoute()).
            post('/config/reload').
            reply(200, OK_RESPONSE);

        await Actions.reloadConfig()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('getEnvironmentConfig', async () => {
        nock(Client4.getBaseRoute()).
            get('/config/environment').
            reply(200, {
                ServiceSettings: {
                    SiteURL: true,
                },
                TeamSettings: {
                    SiteName: true,
                },
            });

        await store.dispatch(Actions.getEnvironmentConfig());

        const state = store.getState();

        const config = state.entities.admin.environmentConfig;
        expect(config).toBeTruthy();
        expect(config.ServiceSettings).toBeTruthy();
        expect(config.ServiceSettings.SiteURL).toBeTruthy();
        expect(config.TeamSettings).toBeTruthy();
        expect(config.TeamSettings.SiteName).toBeTruthy();
    });

    it('testEmail', async () => {
        nock(Client4.getBaseRoute()).
            get('/config').
            reply(200, {});

        const {data: config} = await Actions.getConfig()(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            post('/email/test').
            reply(200, OK_RESPONSE);

        await Actions.testEmail(config)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('testSiteURL', async () => {
        nock(Client4.getBaseRoute()).
            post('/site_url/test').
            reply(200, OK_RESPONSE);

        await Actions.testSiteURL('http://lo.cal')(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('testS3Connection', async () => {
        nock(Client4.getBaseRoute()).
            get('/config').
            reply(200, {});

        const {data: config} = await Actions.getConfig()(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            post('/file/s3_test').
            reply(200, OK_RESPONSE);

        await Actions.testS3Connection(config)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('invalidateCaches', async () => {
        nock(Client4.getBaseRoute()).
            post('/caches/invalidate').
            reply(200, OK_RESPONSE);

        await Actions.invalidateCaches()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('recycleDatabase', async () => {
        nock(Client4.getBaseRoute()).
            post('/database/recycle').
            reply(200, OK_RESPONSE);

        await Actions.recycleDatabase()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('createComplianceReport', async () => {
        const job = {
            desc: 'testjob',
            emails: 'joram@example.com',
            keywords: 'testkeyword',
            start_at: 1457654400000,
            end_at: 1458000000000,
        };

        nock(Client4.getBaseRoute()).
            post('/compliance/reports').
            reply(201, {
                id: 'six4h67ja7ntdkek6g13dp3wka',
                create_at: 1491399241953,
                user_id: 'ua7yqgjiq3dabc46ianp3yfgty',
                status: 'running',
                count: 0,
                desc: 'testjob',
                type: 'adhoc',
                start_at: 1457654400000,
                end_at: 1458000000000,
                keywords: 'testkeyword',
                emails: 'joram@example.com',
            });

        const {data: created} = await Actions.createComplianceReport(job)(store.dispatch, store.getState) as ActionResult;

        const state = store.getState();
        const request = state.requests.admin.createCompliance;
        if (request.status === RequestStatus.FAILURE) {
            throw new Error('createComplianceReport request failed');
        }

        const reports = state.entities.admin.complianceReports;
        expect(reports).toBeTruthy();
        expect(reports[created.id]).toBeTruthy();
    });

    it('getComplianceReport', async () => {
        const job = {
            desc: 'testjob',
            emails: 'joram@example.com',
            keywords: 'testkeyword',
            start_at: 1457654400000,
            end_at: 1458000000000,
        };

        nock(Client4.getBaseRoute()).
            post('/compliance/reports').
            reply(201, {
                id: 'six4h67ja7ntdkek6g13dp3wka',
                create_at: 1491399241953,
                user_id: 'ua7yqgjiq3dabc46ianp3yfgty',
                status: 'running',
                count: 0,
                desc: 'testjob',
                type: 'adhoc',
                start_at: 1457654400000,
                end_at: 1458000000000,
                keywords: 'testkeyword',
                emails: 'joram@example.com',
            });

        const {data: report} = await Actions.createComplianceReport(job)(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/compliance/reports/${report.id}`).
            reply(200, report);

        await Actions.getComplianceReport(report.id)(store.dispatch, store.getState);

        const state = store.getState();

        const reports = state.entities.admin.complianceReports;
        expect(reports).toBeTruthy();
        expect(reports[report.id]).toBeTruthy();
    });

    it('getComplianceReports', async () => {
        const job = {
            desc: 'testjob',
            emails: 'joram@example.com',
            keywords: 'testkeyword',
            start_at: 1457654400000,
            end_at: 1458000000000,
        };

        nock(Client4.getBaseRoute()).
            post('/compliance/reports').
            reply(201, {
                id: 'six4h67ja7ntdkek6g13dp3wka',
                create_at: 1491399241953,
                user_id: 'ua7yqgjiq3dabc46ianp3yfgty',
                status: 'running',
                count: 0,
                desc: 'testjob',
                type: 'adhoc',
                start_at: 1457654400000,
                end_at: 1458000000000,
                keywords: 'testkeyword',
                emails: 'joram@example.com',
            });

        const {data: report} = await Actions.createComplianceReport(job)(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get('/compliance/reports').
            query(true).
            reply(200, [report]);

        await Actions.getComplianceReports()(store.dispatch, store.getState);

        const state = store.getState();

        const reports = state.entities.admin.complianceReports;
        expect(reports).toBeTruthy();
        expect(reports[report.id]).toBeTruthy();
    });

    it('uploadBrandImage', async () => {
        const testImageData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/brand/image').
            reply(200, OK_RESPONSE);

        await Actions.uploadBrandImage(testImageData as any)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('deleteBrandImage', async () => {
        nock(Client4.getBaseRoute()).
            delete('/brand/image').
            reply(200, OK_RESPONSE);

        await Actions.deleteBrandImage()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('getClusterStatus', async () => {
        nock(Client4.getBaseRoute()).
            get('/cluster/status').
            reply(200, [
                {
                    id: 'someid',
                    version: 'someversion',
                },
            ]);

        await Actions.getClusterStatus()(store.dispatch, store.getState);

        const state = store.getState();

        const clusterInfo = state.entities.admin.clusterInfo;
        expect(clusterInfo).toBeTruthy();
        expect(clusterInfo.length === 1).toBeTruthy();
        expect(clusterInfo[0].id === 'someid').toBeTruthy();
    });

    it('testLdap', async () => {
        nock(Client4.getBaseRoute()).
            post('/ldap/test').
            reply(200, OK_RESPONSE);

        await Actions.testLdap()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('syncLdap', async () => {
        nock(Client4.getBaseRoute()).
            post('/ldap/sync').
            reply(200, OK_RESPONSE);

        await Actions.syncLdap()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('getSamlCertificateStatus', async () => {
        nock(Client4.getBaseRoute()).
            get('/saml/certificate/status').
            reply(200, {
                public_certificate_file: true,
                private_key_file: true,
                idp_certificate_file: true,
            });

        await Actions.getSamlCertificateStatus()(store.dispatch, store.getState);

        const state = store.getState();

        const certStatus = state.entities.admin.samlCertStatus;
        expect(certStatus).toBeTruthy();
        expect(certStatus.idp_certificate_file).toBeTruthy();
        expect(certStatus.private_key_file).toBeTruthy();
        expect(certStatus.public_certificate_file).toBeTruthy();
    });

    it('uploadPublicSamlCertificate', async () => {
        const testFileData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/saml/certificate/public').
            reply(200, OK_RESPONSE);

        await Actions.uploadPublicSamlCertificate(testFileData as any)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('uploadPrivateSamlCertificate', async () => {
        const testFileData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/saml/certificate/private').
            reply(200, OK_RESPONSE);

        await Actions.uploadPrivateSamlCertificate(testFileData as any)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('uploadIdpSamlCertificate', async () => {
        const testFileData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/saml/certificate/idp').
            reply(200, OK_RESPONSE);

        await Actions.uploadIdpSamlCertificate(testFileData as any)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('removePublicSamlCertificate', async () => {
        nock(Client4.getBaseRoute()).
            delete('/saml/certificate/public').
            reply(200, OK_RESPONSE);

        await Actions.removePublicSamlCertificate()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('removePrivateSamlCertificate', async () => {
        nock(Client4.getBaseRoute()).
            delete('/saml/certificate/private').
            reply(200, OK_RESPONSE);

        await Actions.removePrivateSamlCertificate()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('removeIdpSamlCertificate', async () => {
        nock(Client4.getBaseRoute()).
            delete('/saml/certificate/idp').
            reply(200, OK_RESPONSE);

        await Actions.removeIdpSamlCertificate()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('uploadPublicLdapCertificate', async () => {
        const testFileData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/ldap/certificate/public').
            reply(200, OK_RESPONSE);

        await Actions.uploadPublicLdapCertificate(testFileData as any)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('uploadPrivateLdapCertificate', async () => {
        const testFileData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/ldap/certificate/private').
            reply(200, OK_RESPONSE);

        await Actions.uploadPrivateLdapCertificate(testFileData as any)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('removePublicLdapCertificate', async () => {
        nock(Client4.getBaseRoute()).
            delete('/ldap/certificate/public').
            reply(200, OK_RESPONSE);

        await Actions.removePublicLdapCertificate()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('removePrivateLdapCertificate', async () => {
        nock(Client4.getBaseRoute()).
            delete('/ldap/certificate/private').
            reply(200, OK_RESPONSE);

        await Actions.removePrivateLdapCertificate()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('testElasticsearch', async () => {
        nock(Client4.getBaseRoute()).
            post('/elasticsearch/test').
            reply(200, OK_RESPONSE);

        await Actions.testElasticsearch({})(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('purgeElasticsearchIndexes', async () => {
        nock(Client4.getBaseRoute()).
            post('/elasticsearch/purge_indexes').
            reply(200, OK_RESPONSE);

        await Actions.purgeElasticsearchIndexes()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('uploadLicense', async () => {
        const testFileData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getBaseRoute()).
            post('/license').
            reply(200, OK_RESPONSE);

        await Actions.uploadLicense(testFileData as any)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('removeLicense', async () => {
        nock(Client4.getBaseRoute()).
            delete('/license').
            reply(200, OK_RESPONSE);

        await Actions.removeLicense()(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('getStandardAnalytics', async () => {
        nock(Client4.getBaseRoute()).
            get('/analytics/old').
            query(true).
            times(2).
            reply(200, [{name: 'channel_open_count', value: 495}, {name: 'channel_private_count', value: 19}, {name: 'post_count', value: 2763}, {name: 'unique_user_count', value: 316}, {name: 'team_count', value: 159}, {name: 'total_websocket_connections', value: 1}, {name: 'total_master_db_connections', value: 8}, {name: 'total_read_db_connections', value: 0}, {name: 'daily_active_users', value: 22}, {name: 'monthly_active_users', value: 114}, {name: 'registered_users', value: 500}]);

        await Actions.getStandardAnalytics()(store.dispatch, store.getState);
        await Actions.getStandardAnalytics(TestHelper.basicTeam!.id)(store.dispatch, store.getState);

        const state = store.getState();

        const analytics = state.entities.admin.analytics;
        expect(analytics).toBeTruthy();
        expect(analytics[Stats.TOTAL_PUBLIC_CHANNELS] > 0).toBeTruthy();

        const teamAnalytics = state.entities.admin.teamAnalytics;
        expect(teamAnalytics).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id][Stats.TOTAL_PUBLIC_CHANNELS] > 0).toBeTruthy();
    });

    it('getAdvancedAnalytics', async () => {
        nock(Client4.getBaseRoute()).
            get('/analytics/old').
            query(true).
            times(2).
            reply(200, [{name: 'file_post_count', value: 24}, {name: 'hashtag_post_count', value: 876}, {name: 'incoming_webhook_count', value: 16}, {name: 'outgoing_webhook_count', value: 18}, {name: 'command_count', value: 14}, {name: 'session_count', value: 149}]);

        await Actions.getAdvancedAnalytics()(store.dispatch, store.getState);
        await Actions.getAdvancedAnalytics(TestHelper.basicTeam!.id)(store.dispatch, store.getState);

        const state = store.getState();

        const analytics = state.entities.admin.analytics;
        expect(analytics).toBeTruthy();
        expect(analytics[Stats.TOTAL_SESSIONS] > 0).toBeTruthy();

        const teamAnalytics = state.entities.admin.teamAnalytics;
        expect(teamAnalytics).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id][Stats.TOTAL_SESSIONS] > 0).toBeTruthy();
    });

    it('getPostsPerDayAnalytics', async () => {
        nock(Client4.getBaseRoute()).
            get('/analytics/old').
            query(true).
            times(2).
            reply(200, [{name: '2017-06-18', value: 16}, {name: '2017-06-16', value: 209}, {name: '2017-06-12', value: 35}, {name: '2017-06-08', value: 227}, {name: '2017-06-07', value: 27}, {name: '2017-06-06', value: 136}, {name: '2017-06-05', value: 127}, {name: '2017-06-04', value: 39}, {name: '2017-06-02', value: 3}, {name: '2017-05-31', value: 52}, {name: '2017-05-30', value: 52}, {name: '2017-05-29', value: 9}, {name: '2017-05-26', value: 198}, {name: '2017-05-25', value: 144}, {name: '2017-05-24', value: 1130}, {name: '2017-05-23', value: 146}]);

        await Actions.getPostsPerDayAnalytics()(store.dispatch, store.getState);
        await Actions.getPostsPerDayAnalytics(TestHelper.basicTeam!.id)(store.dispatch, store.getState);

        const state = store.getState();

        const analytics = state.entities.admin.analytics;
        expect(analytics).toBeTruthy();
        expect(analytics[Stats.POST_PER_DAY]).toBeTruthy();

        const teamAnalytics = state.entities.admin.teamAnalytics;
        expect(teamAnalytics).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id][Stats.POST_PER_DAY]).toBeTruthy();
    });

    it('getUsersPerDayAnalytics', async () => {
        nock(Client4.getBaseRoute()).
            get('/analytics/old').
            query(true).
            times(2).
            reply(200, [{name: '2017-06-18', value: 2}, {name: '2017-06-16', value: 47}, {name: '2017-06-12', value: 4}, {name: '2017-06-08', value: 55}, {name: '2017-06-07', value: 2}, {name: '2017-06-06', value: 1}, {name: '2017-06-05', value: 2}, {name: '2017-06-04', value: 13}, {name: '2017-06-02', value: 1}, {name: '2017-05-31', value: 3}, {name: '2017-05-30', value: 4}, {name: '2017-05-29', value: 3}, {name: '2017-05-26', value: 40}, {name: '2017-05-25', value: 26}, {name: '2017-05-24', value: 43}, {name: '2017-05-23', value: 3}]);

        await Actions.getUsersPerDayAnalytics()(store.dispatch, store.getState);
        await Actions.getUsersPerDayAnalytics(TestHelper.basicTeam!.id)(store.dispatch, store.getState);

        const state = store.getState();

        const analytics = state.entities.admin.analytics;
        expect(analytics).toBeTruthy();
        expect(analytics[Stats.USERS_WITH_POSTS_PER_DAY]).toBeTruthy();

        const teamAnalytics = state.entities.admin.teamAnalytics;
        expect(teamAnalytics).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(teamAnalytics[TestHelper.basicTeam!.id][Stats.USERS_WITH_POSTS_PER_DAY]).toBeTruthy();
    });

    it('uploadPlugin', async () => {
        const testFileData = fs.createReadStream('packages/mattermost-redux/test/assets/images/test.png');
        const testPlugin = {id: 'testplugin', webapp: {bundle_path: '/static/somebundle.js'}};

        nock(Client4.getBaseRoute()).
            post('/plugins').
            reply(200, testPlugin);
        await Actions.uploadPlugin(testFileData as any, false)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('overwriteInstallPlugin', async () => {
        const downloadUrl = 'testplugin.tar.gz';
        const testPlugin = {id: 'testplugin', webapp: {bundle_path: '/static/somebundle.js'}};

        let urlMatch = `/plugins/install_from_url?plugin_download_url=${downloadUrl}&force=false`;
        let scope = nock(Client4.getBaseRoute()).
            post(urlMatch).
            reply(200, testPlugin);
        await Actions.installPluginFromUrl(downloadUrl, false)(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);

        urlMatch = `/plugins/install_from_url?plugin_download_url=${downloadUrl}&force=true`;
        scope = nock(Client4.getBaseRoute()).
            post(urlMatch).
            reply(200, testPlugin);
        await Actions.installPluginFromUrl(downloadUrl, true)(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);
    });

    it('installPluginFromUrl', async () => {
        const downloadUrl = 'testplugin.tar.gz';
        const testPlugin = {id: 'testplugin', webapp: {bundle_path: '/static/somebundle.js'}};

        const urlMatch = `/plugins/install_from_url?plugin_download_url=${downloadUrl}&force=false`;
        nock(Client4.getBaseRoute()).
            post(urlMatch).
            reply(200, testPlugin);
        await Actions.installPluginFromUrl(downloadUrl, false)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('getPlugins', async () => {
        const testPlugin = {id: 'testplugin', webapp: {bundle_path: '/static/somebundle.js'}};
        const testPlugin2 = {id: 'testplugin2', webapp: {bundle_path: '/static/somebundle.js'}};

        nock(Client4.getBaseRoute()).
            get('/plugins').
            reply(200, {active: [testPlugin], inactive: [testPlugin2]});

        await Actions.getPlugins()(store.dispatch, store.getState);

        const state = store.getState();

        const plugins = state.entities.admin.plugins;
        expect(plugins).toBeTruthy();
        expect(plugins[testPlugin.id]).toBeTruthy();
        expect(plugins[testPlugin.id].active).toBeTruthy();
        expect(plugins[testPlugin2.id]).toBeTruthy();
        expect(!plugins[testPlugin2.id].active).toBeTruthy();
    });

    it('getPluginStatuses', async () => {
        const testPluginStatus = {
            plugin_id: 'testplugin',
            state: 1,
        };
        const testPluginStatus2 = {
            plugin_id: 'testplugin2',
            state: 0,
        };

        nock(Client4.getBaseRoute()).
            get('/plugins/statuses').
            reply(200, [testPluginStatus, testPluginStatus2]);

        await Actions.getPluginStatuses()(store.dispatch, store.getState);

        const state = store.getState();

        const pluginStatuses = state.entities.admin.pluginStatuses;
        expect(pluginStatuses).toBeTruthy();
        expect(pluginStatuses[testPluginStatus.plugin_id]).toBeTruthy();
        expect(pluginStatuses[testPluginStatus.plugin_id].active).toBeTruthy();
        expect(pluginStatuses[testPluginStatus2.plugin_id]).toBeTruthy();
        expect(!pluginStatuses[testPluginStatus2.plugin_id].active).toBeTruthy();
    });

    it('removePlugin', async () => {
        const testPlugin = {id: 'testplugin3', webapp: {bundle_path: '/static/somebundle.js'}};

        nock(Client4.getBaseRoute()).
            get('/plugins').
            reply(200, {active: [], inactive: [testPlugin]});

        await Actions.getPlugins()(store.dispatch, store.getState);

        let state = store.getState();
        let plugins = state.entities.admin.plugins;
        expect(plugins).toBeTruthy();
        expect(plugins[testPlugin.id]).toBeTruthy();

        nock(Client4.getBaseRoute()).
            delete(`/plugins/${testPlugin.id}`).
            reply(200, OK_RESPONSE);

        await Actions.removePlugin(testPlugin.id)(store.dispatch, store.getState);

        state = store.getState();
        plugins = state.entities.admin.plugins;
        expect(plugins).toBeTruthy();
        expect(!plugins[testPlugin.id]).toBeTruthy();
    });

    it('enablePlugin', async () => {
        const testPlugin = {id: TestHelper.generateId(), webapp: {bundle_path: '/static/somebundle.js'}};

        nock(Client4.getBaseRoute()).
            get('/plugins').
            reply(200, {active: [], inactive: [testPlugin]});

        await Actions.getPlugins()(store.dispatch, store.getState);

        let state = store.getState();
        let plugins = state.entities.admin.plugins;
        expect(plugins).toBeTruthy();
        expect(plugins[testPlugin.id]).toBeTruthy();
        expect(!plugins[testPlugin.id].active).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post(`/plugins/${testPlugin.id}/enable`).
            reply(200, OK_RESPONSE);

        await Actions.enablePlugin(testPlugin.id)(store.dispatch, store.getState);

        state = store.getState();
        plugins = state.entities.admin.plugins;
        expect(plugins).toBeTruthy();
        expect(plugins[testPlugin.id]).toBeTruthy();
        expect(plugins[testPlugin.id].active).toBeTruthy();
    });

    it('disablePlugin', async () => {
        const testPlugin = {id: TestHelper.generateId(), webapp: {bundle_path: '/static/somebundle.js'}};

        nock(Client4.getBaseRoute()).
            get('/plugins').
            reply(200, {active: [testPlugin], inactive: []});

        await Actions.getPlugins()(store.dispatch, store.getState);

        let state = store.getState();
        let plugins = state.entities.admin.plugins;
        expect(plugins).toBeTruthy();
        expect(plugins[testPlugin.id]).toBeTruthy();
        expect(plugins[testPlugin.id].active).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post(`/plugins/${testPlugin.id}/disable`).
            reply(200, OK_RESPONSE);

        await Actions.disablePlugin(testPlugin.id)(store.dispatch, store.getState);

        state = store.getState();
        plugins = state.entities.admin.plugins;
        expect(plugins).toBeTruthy();
        expect(plugins[testPlugin.id]).toBeTruthy();
        expect(!plugins[testPlugin.id].active).toBeTruthy();
    });

    it('getLdapGroups', async () => {
        const ldapGroups = {
            count: 2,
            groups: [
                {primary_key: 'test1', name: 'test1', mattermost_group_id: null, has_syncables: false},
                {primary_key: 'test2', name: 'test2', mattermost_group_id: 'mattermost-id', has_syncables: true},
            ],
        };

        nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100').
            reply(200, ldapGroups);

        await Actions.getLdapGroups(0, 100, null as any)(store.dispatch, store.getState);

        const state = store.getState();

        const groups = state.entities.admin.ldapGroups;
        expect(groups).toBeTruthy();
        expect(groups[ldapGroups.groups[0].primary_key]).toBeTruthy();
        expect(groups[ldapGroups.groups[1].primary_key]).toBeTruthy();
    });

    it('getLdapGroups is_linked', async () => {
        let scope = nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100&q=&is_linked=true').
            reply(200, NO_GROUPS_RESPONSE);

        await Actions.getLdapGroups(0, 100, {q: '', is_linked: true})(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);

        scope = nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100&q=&is_linked=false').
            reply(200, NO_GROUPS_RESPONSE);

        await Actions.getLdapGroups(0, 100, {q: '', is_linked: false})(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);
    });

    it('getLdapGroups is_configured', async () => {
        let scope = nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100&q=&is_configured=true').
            reply(200, NO_GROUPS_RESPONSE);

        await Actions.getLdapGroups(0, 100, {q: '', is_configured: true})(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);

        scope = nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100&q=&is_configured=false').
            reply(200, NO_GROUPS_RESPONSE);

        await Actions.getLdapGroups(0, 100, {q: '', is_configured: false})(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);
    });

    it('getLdapGroups with name query', async () => {
        let scope = nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100&q=est').
            reply(200, NO_GROUPS_RESPONSE);

        await Actions.getLdapGroups(0, 100, {q: 'est'})(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);

        scope = nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100&q=esta').
            reply(200, NO_GROUPS_RESPONSE);

        await Actions.getLdapGroups(0, 100, {q: 'esta'})(store.dispatch, store.getState);

        expect(scope.isDone()).toBe(true);
    });

    it('linkLdapGroup', async () => {
        const ldapGroups = {
            count: 2,
            groups: [
                {primary_key: 'test1', name: 'test1', mattermost_group_id: null, has_syncables: false},
                {primary_key: 'test2', name: 'test2', mattermost_group_id: 'mattermost-id', has_syncables: true},
            ],
        };

        nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100').
            reply(200, ldapGroups);

        await Actions.getLdapGroups(0, 100, null as any)(store.dispatch, store.getState);

        const key = 'test1';

        nock(Client4.getBaseRoute()).
            post(`/ldap/groups/${key}/link`).
            reply(200, {display_name: 'test1', id: 'new-mattermost-id'});

        await Actions.linkLdapGroup(key)(store.dispatch, store.getState);

        const state = store.getState();
        const groups = state.entities.admin.ldapGroups;
        expect(groups[key]).toBeTruthy();
        expect(groups[key].mattermost_group_id === 'new-mattermost-id').toBeTruthy();
        expect(groups[key].has_syncables === false).toBeTruthy();
    });

    it('unlinkLdapGroup', async () => {
        const ldapGroups = {
            count: 2,
            groups: [
                {primary_key: 'test1', name: 'test1', mattermost_group_id: null, has_syncables: false},
                {primary_key: 'test2', name: 'test2', mattermost_group_id: 'mattermost-id', has_syncables: true},
            ],
        };

        nock(Client4.getBaseRoute()).
            get('/ldap/groups?page=0&per_page=100').
            reply(200, ldapGroups);

        await Actions.getLdapGroups(0, 100, null as any)(store.dispatch, store.getState);

        const key = 'test2';

        nock(Client4.getBaseRoute()).
            delete(`/ldap/groups/${key}/link`).
            reply(200, {ok: true});

        await Actions.unlinkLdapGroup(key)(store.dispatch, store.getState);

        const state = store.getState();
        const groups = state.entities.admin.ldapGroups;
        expect(groups[key]).toBeTruthy();
        expect(groups[key].mattermost_group_id === undefined).toBeTruthy();
        expect(groups[key].has_syncables === undefined).toBeTruthy();
    });

    it('getSamlMetadataFromIdp', async () => {
        nock(Client4.getBaseRoute()).
            post('/saml/metadatafromidp').
            reply(200, {
                idp_url: samlIdpURL,
                idp_descriptor_url: samlIdpDescriptorURL,
                idp_public_certificate: samlIdpPublicCertificateText,
            });

        await Actions.getSamlMetadataFromIdp('')(store.dispatch, store.getState);

        const state = store.getState();
        const metadataResponse = state.entities.admin.samlMetadataResponse;
        expect(metadataResponse).toBeTruthy();
        expect(metadataResponse.idp_url === samlIdpURL).toBeTruthy();
        expect(metadataResponse.idp_descriptor_url === samlIdpDescriptorURL).toBeTruthy();
        expect(metadataResponse.idp_public_certificate === samlIdpPublicCertificateText).toBeTruthy();
    });

    it('setSamlIdpCertificateFromMetadata', async () => {
        nock(Client4.getBaseRoute()).
            post('/saml/certificate/idp').
            reply(200, OK_RESPONSE);

        await Actions.setSamlIdpCertificateFromMetadata(samlIdpPublicCertificateText)(store.dispatch, store.getState);

        expect(nock.isDone()).toBe(true);
    });

    it('sendWarnMetricAck', async () => {
        const warnMetricAck = {
            id: 'metric1',
        };
        nock(Client4.getBaseRoute()).
            post('/warn_metrics/ack/metric1').
            reply(200, OK_RESPONSE);

        await Actions.sendWarnMetricAck(warnMetricAck.id, false)(store.dispatch);

        expect(nock.isDone()).toBe(true);
    });

    it('getDataRetentionCustomPolicies', async () => {
        const policies = {
            policies: [
                {
                    id: 'id1',
                    display_name: 'Test Policy',
                    post_duration: 100,
                    team_count: 2,
                    channel_count: 1,
                },
                {
                    id: 'id2',
                    display_name: 'Test Policy 2',
                    post_duration: 365,
                    team_count: 0,
                    channel_count: 9,
                },
            ],
            total_count: 2,
        };
        nock(Client4.getBaseRoute()).
            get('/data_retention/policies?page=0&per_page=10').
            reply(200, policies);

        await Actions.getDataRetentionCustomPolicies()(store.dispatch, store.getState);

        const state = store.getState();
        const policesState = state.entities.admin.dataRetentionCustomPolicies;
        expect(policesState).toBeTruthy();

        expect(policesState.id1.id === 'id1').toBeTruthy();
        expect(policesState.id1.display_name === 'Test Policy').toBeTruthy();
        expect(policesState.id1.post_duration === 100).toBeTruthy();
        expect(policesState.id1.team_count === 2).toBeTruthy();
        expect(policesState.id1.channel_count === 1).toBeTruthy();

        expect(policesState.id2.id === 'id2').toBeTruthy();
        expect(policesState.id2.display_name === 'Test Policy 2').toBeTruthy();
        expect(policesState.id2.post_duration === 365).toBeTruthy();
        expect(policesState.id2.team_count === 0).toBeTruthy();
        expect(policesState.id2.channel_count === 9).toBeTruthy();
    });

    it('getDataRetentionCustomPolicy', async () => {
        const policy = {
            id: 'id1',
            display_name: 'Test Policy',
            post_duration: 100,
            team_count: 2,
            channel_count: 1,
        };
        nock(Client4.getBaseRoute()).
            get('/data_retention/policies/id1').
            reply(200, policy);

        await Actions.getDataRetentionCustomPolicy('id1')(store.dispatch, store.getState);

        const state = store.getState();
        const policesState = state.entities.admin.dataRetentionCustomPolicies;
        expect(policesState).toBeTruthy();

        expect(policesState.id1.id === 'id1').toBeTruthy();
        expect(policesState.id1.display_name === 'Test Policy').toBeTruthy();
        expect(policesState.id1.post_duration === 100).toBeTruthy();
        expect(policesState.id1.team_count === 2).toBeTruthy();
        expect(policesState.id1.channel_count === 1).toBeTruthy();
    });

    it('getDataRetentionCustomPolicyTeams', async () => {
        const teams = [
            {
                ...TestHelper.fakeTeam(),
                policy_id: 'id1',
                id: 'teamId1',
            },
        ];
        nock(Client4.getBaseRoute()).
            get('/data_retention/policies/id1/teams?page=0&per_page=50').
            reply(200, {
                teams,
                total_count: 1,
            });

        await Actions.getDataRetentionCustomPolicyTeams('id1')(store.dispatch, store.getState);

        const state = store.getState();
        const teamsState = state.entities.teams.teams;

        expect(teamsState).toBeTruthy();
        expect(teamsState.teamId1.policy_id === 'id1').toBeTruthy();
    });

    it('getDataRetentionCustomPolicyChannels', async () => {
        const channels = [
            {
                ...TestHelper.fakeChannel('teamId1'),
                policy_id: 'id1',
                id: 'channelId1',
            },
        ];
        nock(Client4.getBaseRoute()).
            get('/data_retention/policies/id1/channels?page=0&per_page=50').
            reply(200, {
                channels,
                total_count: 1,
            });

        await Actions.getDataRetentionCustomPolicyChannels('id1')(store.dispatch, store.getState);

        const state = store.getState();
        const teamsState = state.entities.channels.channels;

        expect(teamsState).toBeTruthy();
        expect(teamsState.channelId1.policy_id === 'id1').toBeTruthy();
    });

    it('searchDataRetentionCustomPolicyTeams', async () => {
        nock(Client4.getBaseRoute()).
            post('/data_retention/policies/id1/teams/search').
            reply(200, [TestHelper.basicTeam]);

        const response = await store.dispatch(Actions.searchDataRetentionCustomPolicyTeams('id1', 'test', {}));

        expect(response.data.length === 1).toBeTruthy();
    });

    it('searchDataRetentionCustomPolicyChannels', async () => {
        nock(Client4.getBaseRoute()).
            post('/data_retention/policies/id1/channels/search').
            reply(200, [TestHelper.basicChannel]);

        const response = await store.dispatch(Actions.searchDataRetentionCustomPolicyChannels('id1', 'test', {}));

        expect(response.data.length === 1).toBeTruthy();
    });

    it('createDataRetentionCustomPolicy', async () => {
        const policy = {
            display_name: 'Test',
            post_duration: 100,
            channel_ids: ['channel1'],
            team_ids: ['team1', 'team2'],
        };
        nock(Client4.getBaseRoute()).
            post('/data_retention/policies').
            reply(200, {
                id: 'id1',
                display_name: 'Test',
                post_duration: 100,
                team_count: 2,
                channel_count: 1,
            });
        await Actions.createDataRetentionCustomPolicy(policy)(store.dispatch, store.getState);

        const state = store.getState();
        const policesState = state.entities.admin.dataRetentionCustomPolicies;
        expect(policesState).toBeTruthy();

        expect(policesState.id1.id === 'id1').toBeTruthy();
        expect(policesState.id1.display_name === 'Test').toBeTruthy();
        expect(policesState.id1.post_duration === 100).toBeTruthy();
        expect(policesState.id1.team_count === 2).toBeTruthy();
        expect(policesState.id1.channel_count === 1).toBeTruthy();
    });

    it('updateDataRetentionCustomPolicy', async () => {
        nock(Client4.getBaseRoute()).
            patch('/data_retention/policies/id1').
            reply(200, {
                id: 'id1',
                display_name: 'Test123',
                post_duration: 365,
                team_count: 2,
                channel_count: 1,
            });
        await Actions.updateDataRetentionCustomPolicy('id1', {display_name: 'Test123', post_duration: 365} as CreateDataRetentionCustomPolicy)(store.dispatch, store.getState);

        const updateState = store.getState();
        const policyState = updateState.entities.admin.dataRetentionCustomPolicies;
        expect(policyState).toBeTruthy();

        expect(policyState.id1.id === 'id1').toBeTruthy();
        expect(policyState.id1.display_name === 'Test123').toBeTruthy();
        expect(policyState.id1.post_duration === 365).toBeTruthy();
        expect(policyState.id1.team_count === 2).toBeTruthy();
        expect(policyState.id1.channel_count === 1).toBeTruthy();
    });

    it('createDataRetentionCustomPolicy', async () => {
        const policy = {
            display_name: 'Test',
            post_duration: 100,
            channel_ids: ['channel1'],
            team_ids: ['team1', 'team2'],
        };
        nock(Client4.getBaseRoute()).
            post('/data_retention/policies').
            reply(200, {
                id: 'id1',
                display_name: 'Test',
                post_duration: 100,
                team_count: 2,
                channel_count: 1,
            });
        await Actions.createDataRetentionCustomPolicy(policy)(store.dispatch, store.getState);

        const state = store.getState();
        const policesState = state.entities.admin.dataRetentionCustomPolicies;
        expect(policesState).toBeTruthy();

        expect(policesState.id1.id === 'id1').toBeTruthy();
        expect(policesState.id1.display_name === 'Test').toBeTruthy();
        expect(policesState.id1.post_duration === 100).toBeTruthy();
        expect(policesState.id1.team_count === 2).toBeTruthy();
        expect(policesState.id1.channel_count === 1).toBeTruthy();
    });

    it('removeDataRetentionCustomPolicyTeams', async () => {
        const teams = [
            {
                ...TestHelper.fakeTeam(),
                policy_id: 'id1',
                id: 'teamId1',
            },
            {
                ...TestHelper.fakeTeam(),
                policy_id: 'id1',
                id: 'teamId2',
            },
        ];
        nock(Client4.getBaseRoute()).
            get('/data_retention/policies/id1/teams?page=0&per_page=50').
            reply(200, {
                teams,
                total_count: 2,
            });

        await Actions.getDataRetentionCustomPolicyTeams('id1')(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            delete('/data_retention/policies/id1/teams').
            reply(200, OK_RESPONSE);

        await Actions.removeDataRetentionCustomPolicyTeams('id1', ['teamId2'])(store.dispatch, store.getState);

        const state = store.getState();
        const teamsState = state.entities.teams.teams;

        expect(teamsState).toBeTruthy();
        expect(teamsState.teamId2.policy_id === null).toBeTruthy();
    });

    it('removeDataRetentionCustomPolicyChannels', async () => {
        const channels = [
            {
                ...TestHelper.fakeChannel('teamId1'),
                policy_id: 'id1',
                id: 'channelId1',
            },
            {
                ...TestHelper.fakeChannel('teamId1'),
                policy_id: 'id1',
                id: 'channelId2',
            },
        ];
        nock(Client4.getBaseRoute()).
            get('/data_retention/policies/id1/channels?page=0&per_page=50').
            reply(200, {
                channels,
                total_count: 1,
            });

        await Actions.getDataRetentionCustomPolicyChannels('id1')(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            delete('/data_retention/policies/id1/channels').
            reply(200, OK_RESPONSE);

        await Actions.removeDataRetentionCustomPolicyChannels('id1', ['channelId2'])(store.dispatch, store.getState);

        const state = store.getState();
        const channelsState = state.entities.channels.channels;

        expect(channelsState).toBeTruthy();
        expect(channelsState.channelId2.policy_id === null).toBeTruthy();
    });
});
