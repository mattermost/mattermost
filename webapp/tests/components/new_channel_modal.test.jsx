// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import Constants from 'utils/constants.jsx';

import NewChannelModal from 'components/new_channel_modal/new_channel_modal.jsx';

describe('components/NewChannelModal', () => {
    afterEach(() => {
        global.window.mm_config = null;
        global.window.mm_license = null;
    });

    test('should match snapshot, modal not showing', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_license = {};
        global.window.mm_license.IsLicensed = 'false';

        const wrapper = shallow(
            <NewChannelModal
                show={true}
                channelType={Constants.OPEN_CHANNEL}
                channelData={{name: 'testchannel', displayName: 'testchannel', header: '', purpose: ''}}
                onSubmitChannel={emptyFunction}
                onModalDismissed={emptyFunction}
                onTypeSwitched={emptyFunction}
                onChangeURLPressed={emptyFunction}
                onDataChanged={emptyFunction}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, modal showing', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_license = {};
        global.window.mm_license.IsLicensed = 'false';

        const wrapper = shallow(
            <NewChannelModal
                show={true}
                channelType={Constants.OPEN_CHANNEL}
                channelData={{name: 'testchannel', displayName: 'testchannel', header: '', purpose: ''}}
                onSubmitChannel={emptyFunction}
                onModalDismissed={emptyFunction}
                onTypeSwitched={emptyFunction}
                onChangeURLPressed={emptyFunction}
                onDataChanged={emptyFunction}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, private channel filled in header and purpose', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_license = {};
        global.window.mm_license.IsLicensed = 'false';

        const wrapper = shallow(
            <NewChannelModal
                show={true}
                channelType={Constants.PRIVATE_CHANNEL}
                channelData={{name: 'testchannel', displayName: 'testchannel', header: 'some header', purpose: 'some purpose'}}
                onSubmitChannel={emptyFunction}
                onModalDismissed={emptyFunction}
                onTypeSwitched={emptyFunction}
                onChangeURLPressed={emptyFunction}
                onDataChanged={emptyFunction}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});
