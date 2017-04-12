// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {mountWithIntl} from 'tests/helpers/intl-test-helper.jsx';

import AboutBuildModal from 'components/about_build_modal.jsx';
import {Modal} from 'react-bootstrap';

describe('components/AboutBuildModal', () => {
    afterEach(() => {
        global.window.mm_config = null;
        global.window.mm_license = null;
    });

    test('should match snapshot for enterprise edition', () => {
        global.window.mm_config = {
            BuildEnterpriseReady: 'true',
            Version: '3.6.0',
            BuildNumber: '3.6.2',
            SQLDriverName: 'Postgres',
            BuildHash: 'abcdef1234567890',
            BuildHashEnterprise: '0123456789abcdef',
            BuildDate: '21 January 2017'
        };

        global.window.mm_license = {
            isLicensed: 'true',
            Company: 'Mattermost Inc'
        };

        const wrapper = shallow(
            <AboutBuildModal
                show={true}
                onModalDismissed={null}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for team edition', () => {
        global.window.mm_config = {
            BuildEnterpriseReady: 'false',
            Version: '3.6.0',
            BuildNumber: '3.6.2',
            SQLDriverName: 'Postgres',
            BuildHash: 'abcdef1234567890',
            BuildDate: '21 January 2017'
        };

        global.window.mm_license = null;

        const wrapper = shallow(
            <AboutBuildModal
                show={true}
                onModalDismissed={null}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should hide the build number if it is the same as the version number', () => {
        global.window.mm_config = {
            BuildEnterpriseReady: 'false',
            Version: '3.6.0',
            BuildNumber: '3.6.0',
            SQLDriverName: 'Postgres',
            BuildHash: 'abcdef1234567890',
            BuildDate: '21 January 2017'
        };

        global.window.mm_license = null;

        const wrapper = shallow(
            <AboutBuildModal
                show={true}
                onModalDismissed={null}
            />
        );
        expect(wrapper.find('#versionString').text()).toBe(' 3.6.0');
    });

    test('should show the build number if it is the different from the version number', () => {
        global.window.mm_config = {
            BuildEnterpriseReady: 'false',
            Version: '3.6.0',
            BuildNumber: '3.6.2',
            SQLDriverName: 'Postgres',
            BuildHash: 'abcdef1234567890',
            BuildDate: '21 January 2017'
        };

        global.window.mm_license = null;

        const wrapper = shallow(
            <AboutBuildModal
                show={true}
                onModalDismissed={null}
            />
        );
        expect(wrapper.find('#versionString').text()).toBe(' 3.6.0\u00a0 (3.6.2)');
    });

    test('should call onModalDismissed callback when the modal is hidden', (done) => {
        global.window.mm_config = {
            BuildEnterpriseReady: 'false',
            Version: '3.6.0',
            BuildNumber: '3.6.2',
            SQLDriverName: 'Postgres',
            BuildHash: 'abcdef1234567890',
            BuildDate: '21 January 2017'
        };

        global.window.mm_license = null;

        function onHide() {
            done();
        }

        const wrapper = mountWithIntl(
            <AboutBuildModal
                show={true}
                onModalDismissed={onHide}
            />
        );
        wrapper.find(Modal).first().props().onHide();
    });
});
