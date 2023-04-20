// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {setThemeDefaults} from 'mattermost-redux/utils/theme_utils';

import {mountWithIntl, shallowWithIntl} from 'tests/helpers/intl-test-helper';

import ImportThemeModal from './import_theme_modal';

describe('components/user_settings/ImportThemeModal', () => {
    const props = {
        intl: {} as any,
        onExited: jest.fn(),
        callback: jest.fn(),
    };

    it('should match snapshot', () => {
        const wrapper = shallowWithIntl(<ImportThemeModal {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should correctly parse a Slack theme', () => {
        const theme = setThemeDefaults({
            type: 'custom',
            sidebarBg: '#1d2229',
            sidebarText: '#ffffff',
            sidebarUnreadText: '#ffffff',
            sidebarTextHoverBg: '#313843',
            sidebarTextActiveBorder: '#537aa6',
            sidebarTextActiveColor: '#ffffff',
            sidebarHeaderBg: '#0b161e',
            sidebarTeamBarBg: '#081118',
            sidebarHeaderTextColor: '#ffffff',
            onlineIndicator: '#94e864',
            mentionBg: '#78af8f',
        });

        const themeString = '#1d2229,#0b161e,#537aa6,#ffffff,#313843,#ffffff,#94e864,#78af8f,#0b161e,#ffffff';
        const wrapper = mountWithIntl(<ImportThemeModal {...props}/>);
        const instance = wrapper.instance();

        instance.setState({show: true});
        wrapper.update();

        wrapper.find('input').simulate('change', {target: {value: themeString}});

        wrapper.find('#submitButton').simulate('click');

        expect(props.callback).toHaveBeenCalledWith(theme);
    });
});
