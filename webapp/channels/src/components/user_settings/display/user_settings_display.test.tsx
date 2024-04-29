// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import configureStore from 'store';

import {getAllLanguages} from 'i18n/i18n';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import UserSettingsDisplay from './user_settings_display';

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const user = {
        id: 'user_id',
        username: 'username',
        locale: 'en',
        timezone: {
            useAutomaticTimezone: 'true',
            automaticTimezone: 'America/New_York',
            manualTimezone: '',
        },
    };

    const requiredProps = {
        user: user as UserProfile,
        updateSection: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        setRequireConfirm: jest.fn(),
        setEnforceFocus: jest.fn(),
        enableLinkPreviews: true,
        enableThemeSelection: false,
        locales: getAllLanguages(),
        userLocale: 'en',
        canCreatePublicChannel: true,
        canCreatePrivateChannel: true,
        timezoneLabel: '',
        timezones: [
            {
                value: 'Caucasus Standard Time',
                abbr: 'CST',
                offset: 4,
                isdst: false,
                text: '(UTC+04:00) Yerevan',
                utc: [
                    'Asia/Yerevan',
                ],
            },
            {
                value: 'Afghanistan Standard Time',
                abbr: 'AST',
                offset: 4.5,
                isdst: false,
                text: '(UTC+04:30) Kabul',
                utc: [
                    'Asia/Kabul',
                ],
            },
        ],
        userTimezone: {
            useAutomaticTimezone: 'true',
            automaticTimezone: 'America/New_York',
            manualTimezone: '',
        },
        actions: {
            autoUpdateTimezone: jest.fn(),
            savePreferences: jest.fn(),
            updateMe: jest.fn(),
        },

        configTeammateNameDisplay: '',
        currentUserTimezone: 'America/New_York',
        shouldAutoUpdateTimezone: true,
        lockTeammateNameDisplay: false,
        collapsedReplyThreads: '',
        collapsedReplyThreadsAllowUserPreference: true,
        allowCustomThemes: true,
        availabilityStatusOnPosts: '',
        militaryTime: '',
        teammateNameDisplay: '',
        channelDisplayMode: '',
        messageDisplay: '',
        colorizeUsernames: '',
        collapseDisplay: '',
        linkPreviewDisplay: '',
        globalHeaderDisplay: '',
        globalHeaderAllowed: true,
        lastActiveDisplay: true,
        oneClickReactionsOnPosts: '',
        emojiPickerEnabled: true,
        clickToReply: '',
        lastActiveTimeEnabled: true,
    };

    let store: ReturnType<typeof configureStore>;
    beforeEach(() => {
        store = configureStore();
    });

    test('should match snapshot, no active section', () => {
        const wrapper = shallow(<UserSettingsDisplay {...requiredProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, collapse section', () => {
        const props = {...requiredProps, activeSection: 'collapse'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, link preview section with EnableLinkPreviews is false', () => {
        const props = {
            ...requiredProps,
            activeSection: 'linkpreview',
            enableLinkPreviews: false,
        };
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, link preview section with EnableLinkPreviews is true', () => {
        const props = {
            ...requiredProps,
            activeSection: 'linkpreview',
            enableLinkPreviews: true,
        };
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, clock section', () => {
        const props = {...requiredProps, activeSection: 'clock'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, teammate name display section', () => {
        const props = {...requiredProps, activeSection: 'teammate_name_display'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, timezone section', () => {
        const props = {...requiredProps, activeSection: 'timezone'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, message display section', () => {
        const props = {...requiredProps, activeSection: 'message_display'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, channel display mode section', () => {
        const props = {...requiredProps, activeSection: 'channel_display_mode'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, languages section', () => {
        const props = {...requiredProps, activeSection: 'languages'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, theme section with EnableThemeSelection is false', () => {
        const props = {
            ...requiredProps,
            activeSection: 'theme',
            enableThemeSelection: false,
        };
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, theme section with EnableThemeSelection is true', () => {
        const props = {
            ...requiredProps,
            activeSection: 'theme',
            enableThemeSelection: true,
        };
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, clickToReply section', () => {
        const props = {...requiredProps, activeSection: 'click_to_reply'};
        const wrapper = shallow(<UserSettingsDisplay {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should have called handleSubmit', async () => {
        const updateSection = jest.fn();

        const props = {...requiredProps, updateSection};
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...props}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        await (wrapper.instance() as UserSettingsDisplay).handleSubmit();
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('should have called updateSection', () => {
        const updateSection = jest.fn();

        const props = {...requiredProps, updateSection};
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...props}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).updateSection('');
        expect(updateSection).toHaveBeenCalledWith('');

        (wrapper.instance() as UserSettingsDisplay).updateSection('linkpreview');
        expect(updateSection).toHaveBeenCalledWith('linkpreview');
    });

    test('should have called closeModal', () => {
        const closeModal = jest.fn();
        const props = {...requiredProps, closeModal};
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...props}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        wrapper.find('#closeButton').simulate('click');
        expect(closeModal).toHaveBeenCalled();
    });

    test('should have called collapseModal', () => {
        const collapseModal = jest.fn();
        const props = {...requiredProps, collapseModal};
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...props}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        wrapper.find('.fa-angle-left').simulate('click');
        expect(collapseModal).toHaveBeenCalled();
    });

    test('should update militaryTime state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleClockRadio('false');
        expect(wrapper.state('militaryTime')).toBe('false');

        (wrapper.instance() as UserSettingsDisplay).handleClockRadio('true');
        expect(wrapper.state('militaryTime')).toBe('true');
    });

    test('should update teammateNameDisplay state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleTeammateNameDisplayRadio('username');
        expect(wrapper.state('teammateNameDisplay')).toBe('username');

        (wrapper.instance() as UserSettingsDisplay).handleTeammateNameDisplayRadio('nickname_full_name');
        expect(wrapper.state('teammateNameDisplay')).toBe('nickname_full_name');

        (wrapper.instance() as UserSettingsDisplay).handleTeammateNameDisplayRadio('full_name');
        expect(wrapper.state('teammateNameDisplay')).toBe('full_name');
    });

    test('should update channelDisplayMode state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleChannelDisplayModeRadio('full');
        expect(wrapper.state('channelDisplayMode')).toBe('full');

        (wrapper.instance() as UserSettingsDisplay).handleChannelDisplayModeRadio('centered');
        expect(wrapper.state('channelDisplayMode')).toBe('centered');
    });

    test('should update messageDisplay state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handlemessageDisplayRadio('clean');
        expect(wrapper.state('messageDisplay')).toBe('clean');

        (wrapper.instance() as UserSettingsDisplay).handlemessageDisplayRadio('compact');
        expect(wrapper.state('messageDisplay')).toBe('compact');
    });

    test('should update collapseDisplay state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleCollapseRadio('false');
        expect(wrapper.state('collapseDisplay')).toBe('false');

        (wrapper.instance() as UserSettingsDisplay).handleCollapseRadio('true');
        expect(wrapper.state('collapseDisplay')).toBe('true');
    });

    test('should update linkPreviewDisplay state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleLinkPreviewRadio('false');
        expect(wrapper.state('linkPreviewDisplay')).toBe('false');

        (wrapper.instance() as UserSettingsDisplay).handleLinkPreviewRadio('true');
        expect(wrapper.state('linkPreviewDisplay')).toBe('true');
    });

    test('should update display state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleOnChange({} as React.ChangeEvent, {display: 'linkPreviewDisplay'});
        expect(wrapper.state('display')).toBe('linkPreviewDisplay');

        (wrapper.instance() as UserSettingsDisplay).handleOnChange({} as React.ChangeEvent, {display: 'collapseDisplay'});
        expect(wrapper.state('display')).toBe('collapseDisplay');
    });

    test('should update collapsed reply threads state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleCollapseReplyThreadsRadio('off');
        expect(wrapper.state('collapsedReplyThreads')).toBe('off');

        (wrapper.instance() as UserSettingsDisplay).handleCollapseReplyThreadsRadio('on');
        expect(wrapper.state('collapsedReplyThreads')).toBe('on');
    });

    test('should update last active state', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsDisplay {...requiredProps}/>
            </Provider>,
        ).find(UserSettingsDisplay);

        (wrapper.instance() as UserSettingsDisplay).handleLastActiveRadio('false');
        expect(wrapper.state('lastActiveDisplay')).toBe('false');

        (wrapper.instance() as UserSettingsDisplay).handleLastActiveRadio('true');
        expect(wrapper.state('lastActiveDisplay')).toBe('true');
    });

    test('should not show last active section', () => {
        const wrapper = shallow(
            <UserSettingsDisplay
                {...requiredProps}
                lastActiveTimeEnabled={false}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
