// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getClassnamesForBody} from './channel_controller';

jest.mock('components/reset_status_modal', () => () => <div/>);
jest.mock('components/sidebar', () => () => <div/>);
jest.mock('components/channel_layout/center_channel', () => () => <div/>);
jest.mock('components/loading_screen', () => () => <div/>);
jest.mock('components/favicon_title_handler', () => () => <div/>);
jest.mock('components/product_notices_modal', () => () => <div/>);
jest.mock('plugins/pluggable', () => () => <div/>);

describe('components/channel_layout/ChannelController', () => {
    test('Should have app__body and channel-view classes by default', () => {
        expect(getClassnamesForBody('')).toEqual(['app__body', 'channel-view']);
    });

    test('Should have os--windows class on body for windows 32 or windows 64', () => {
        expect(getClassnamesForBody('Win32')).toEqual(['app__body', 'channel-view', 'os--windows']);
        expect(getClassnamesForBody('Win64')).toEqual(['app__body', 'channel-view', 'os--windows']);
    });

    test('Should have os--mac class on body for MacIntel or MacPPC', () => {
        expect(getClassnamesForBody('MacIntel')).toEqual(['app__body', 'channel-view', 'os--mac']);
        expect(getClassnamesForBody('MacPPC')).toEqual(['app__body', 'channel-view', 'os--mac']);
    });
});
