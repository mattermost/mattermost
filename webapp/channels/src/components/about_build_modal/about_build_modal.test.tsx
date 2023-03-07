// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {shallow} from 'enzyme';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

import {ClientConfig, ClientLicense} from '@mattermost/types/config';

import AboutBuildModal from 'components/about_build_modal/about_build_modal';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import {AboutLinks} from 'utils/constants';

import AboutBuildModalCloud from './about_build_modal_cloud/about_build_modal_cloud';

describe('components/AboutBuildModal', () => {
    const RealDate: DateConstructor = Date;

    function mockDate(date: Date) {
        function mock() {
            return new RealDate(date);
        }
        mock.now = () => date.getTime();
        global.Date = mock as any;
    }

    let config: Partial<ClientConfig> = {};
    let license: ClientLicense = {};

    afterEach(() => {
        global.Date = RealDate;
        config = {};
        license = {};
    });

    beforeEach(() => {
        mockDate(new Date(2017, 6, 1));

        config = {
            BuildEnterpriseReady: 'true',
            Version: '3.6.0',
            SchemaVersion: '77',
            BuildNumber: '3.6.2',
            SQLDriverName: 'Postgres',
            BuildHash: 'abcdef1234567890',
            BuildHashEnterprise: '0123456789abcdef',
            BuildDate: '21 January 2017',
            TermsOfServiceLink: 'https://about.custom.com/default-terms/',
            PrivacyPolicyLink: 'https://about.custom.com/privacy-policy/',
        };
        license = {
            IsLicensed: 'true',
            Company: 'Mattermost Inc',
        };
    });

    test('should match snapshot for enterprise edition', () => {
        const wrapper = shallowAboutBuildModal({config, license});
        expect(wrapper.find('#versionString').text()).toBe('\u00a03.6.2');
        expect(wrapper.find('#dbversionString').text()).toBe('\u00a077');
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for team edition', () => {
        const teamConfig = {
            ...config,
            BuildEnterpriseReady: 'false',
            BuildHashEnterprise: '',
        };

        const wrapper = shallowAboutBuildModal({config: teamConfig, license: {}});
        expect(wrapper.find('#versionString').text()).toBe('\u00a03.6.2');
        expect(wrapper.find('#dbversionString').text()).toBe('\u00a077');
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for cloud edition', () => {
        if (license !== null) {
            license.Cloud = 'true';
        }
        const store = mockStore();

        const wrapper = shallow(
            <Provider store={store}>
                <AboutBuildModalCloud
                    config={config}
                    license={license}
                    show={true}
                    onExited={jest.fn()}
                    doHide={jest.fn()}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show dev if this is a dev build', () => {
        const sameBuildConfig = {
            ...config,
            BuildEnterpriseReady: 'false',
            BuildHashEnterprise: '',
            Version: '3.6.0',
            SchemaVersion: '77',
            BuildNumber: 'dev',
        };

        const wrapper = shallowAboutBuildModal({config: sameBuildConfig, license: {}});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('#versionString').text()).toBe('\u00a0dev');
        expect(wrapper.find('#dbversionString').text()).toBe('\u00a077');
    });

    test('should show ci if a ci build', () => {
        const differentBuildConfig = {
            ...config,
            BuildEnterpriseReady: 'false',
            BuildHashEnterprise: '',
            Version: '3.6.0',
            SchemaVersion: '77',
            BuildNumber: '123',
        };

        const wrapper = shallowAboutBuildModal({config: differentBuildConfig, license: {}});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('#versionString').text()).toBe('\u00a0ci');
        expect(wrapper.find('#dbversionString').text()).toBe('\u00a077');
        expect(wrapper.find('#buildnumberString').text()).toBe('\u00a0123');
    });

    test('should call onExited callback when the modal is hidden', () => {
        const onExited = jest.fn();

        const wrapper = mountWithIntl(
            <AboutBuildModal
                config={config}
                license={license}
                webappBuildHash='0a1b2c3d4f'
                onExited={onExited}
            />,
        );

        wrapper.find(Modal).first().props().onExited?.(document.createElement('div'));
        expect(onExited).toHaveBeenCalledTimes(1);
    });

    test('should show default tos and privacy policy links and not the config links', () => {
        const wrapper = mountWithIntl(
            <AboutBuildModal
                config={config}
                license={license}
                onExited={jest.fn()}
            />,
        );

        expect(wrapper.find('#tosLink').props().href).toBe(AboutLinks.TERMS_OF_SERVICE);
        expect(wrapper.find('#privacyLink').props().href).toBe(AboutLinks.PRIVACY_POLICY);

        expect(wrapper.find('#tosLink').props().href).not.toBe(config?.TermsOfServiceLink);
        expect(wrapper.find('#privacyLink').props().href).not.toBe(config?.PrivacyPolicyLink);
    });

    function shallowAboutBuildModal(props = {}) {
        const onExited = jest.fn();
        const show = true;

        const allProps = {
            show,
            onExited,
            webappBuildHash: '0a1b2c3d4f',
            config,
            license,
            ...props,
        };

        return shallow(<AboutBuildModal {...allProps}/>);
    }
});
