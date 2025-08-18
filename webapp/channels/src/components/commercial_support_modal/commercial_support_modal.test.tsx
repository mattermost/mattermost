// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import CommercialSupportModal from 'components/commercial_support_modal/commercial_support_modal';

import {TestHelper} from 'utils/test_helper';

describe('components/CommercialSupportModal', () => {
    beforeAll(() => {
        // Mock getSystemRoute to return a valid URL
        jest.spyOn(Client4, 'getSystemRoute').mockImplementation(() => 'http://localhost:8065/api/v4/system');

        // Mock createObjectURL
        window.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
    });

    afterAll(() => {
        jest.restoreAllMocks();

        // @ts-expect-error - TS doesn't like deleting built-in methods
        delete window.URL.createObjectURL;
    });

    const baseProps = {
        onExited: jest.fn(),
        showBannerWarning: false,
        isCloud: false,
        currentUser: TestHelper.getUserMock(),
        packetContents: [
            {id: 'basic.server.logs', label: 'Server Logs', selected: true, mandatory: true},
        ],
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<CommercialSupportModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should show error message when download fails', async () => {
        const errorMessage = 'Failed to download';
        const detailedError = 'Permission denied';

        // Mock the fetch call to return an error
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({
                    message: errorMessage,
                    detailed_error: detailedError,
                }),
            }),
        );

        const wrapper = shallow<CommercialSupportModal>(<CommercialSupportModal {...baseProps}/>);

        // Trigger download
        const instance = wrapper.instance();
        await instance.downloadSupportPacket();
        wrapper.update();

        // Verify error message is shown
        const errorDiv = wrapper.find('.CommercialSupportModal__error');
        expect(errorDiv.exists()).toBe(true);
        expect(errorDiv.find('.error-text').text()).toBe(`${errorMessage}: ${detailedError}`);

        // Verify loading state is reset
        expect(wrapper.state('loading')).toBe(false);
    });

    test('should clear error when starting new download', async () => {
        // Mock the fetch call to succeed
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(new Blob()),
                headers: {get: () => null},
            }),
        );

        const wrapper = shallow<CommercialSupportModal>(<CommercialSupportModal {...baseProps}/>);

        // Set initial error state
        wrapper.setState({error: 'Previous error'});

        // Start download
        const instance = wrapper.instance();
        await instance.downloadSupportPacket();

        // Verify error is cleared
        expect(wrapper.state('error')).toBeUndefined();
    });
});
