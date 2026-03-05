// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {getAllLanguages} from 'i18n/i18n';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import UserSettingsDisplay from './user_settings_display';

jest.mock('./manage_timezones', () => ({
    __esModule: true,
    default: () => <div data-testid='manage-timezones'/>,
}));

jest.mock('./manage_languages', () => ({
    __esModule: true,
    default: () => <div data-testid='manage-languages'/>,
}));

jest.mock('components/user_settings/display/user_settings_theme', () => ({
    __esModule: true,
    default: () => <div data-testid='theme-setting'/>,
}));

jest.mock('./render_emoticons_as_emoji', () => ({
    __esModule: true,
    default: () => <div data-testid='render-emoticons'/>,
}));

jest.mock('utils/timezone', () => ({
    getBrowserTimezone: jest.fn(() => 'America/New_York'),
}));

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
        adminMode: false,
        user: user as UserProfile,
        updateSection: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        setRequireConfirm: jest.fn(),
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
            patchUser: jest.fn(),
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
        renderEmoticonsAsEmoji: '',
        emojiPickerEnabled: true,
        clickToReply: '',
        lastActiveTimeEnabled: true,
    };

    test('should match snapshot, no active section', () => {
        const {container} = renderWithContext(<UserSettingsDisplay {...requiredProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, collapse section', () => {
        const props = {...requiredProps, activeSection: 'collapse'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, link preview section with EnableLinkPreviews is false', () => {
        const props = {
            ...requiredProps,
            activeSection: 'linkpreview',
            enableLinkPreviews: false,
        };
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, link preview section with EnableLinkPreviews is true', () => {
        const props = {
            ...requiredProps,
            activeSection: 'linkpreview',
            enableLinkPreviews: true,
        };
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, clock section', () => {
        const props = {...requiredProps, activeSection: 'clock'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, teammate name display section', () => {
        const props = {...requiredProps, activeSection: 'teammate_name_display'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, timezone section', () => {
        const props = {...requiredProps, activeSection: 'timezone'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, message display section', () => {
        const props = {...requiredProps, activeSection: 'message_display'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel display mode section', () => {
        const props = {...requiredProps, activeSection: 'channel_display_mode'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, languages section', () => {
        const props = {...requiredProps, activeSection: 'languages'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, theme section with EnableThemeSelection is false', () => {
        const props = {
            ...requiredProps,
            activeSection: 'theme',
            enableThemeSelection: false,
        };
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, theme section with EnableThemeSelection is true', () => {
        const props = {
            ...requiredProps,
            activeSection: 'theme',
            enableThemeSelection: true,
        };
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, clickToReply section', () => {
        const props = {...requiredProps, activeSection: 'click_to_reply'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should have called handleSubmit', async () => {
        const updateSection = jest.fn();

        const props = {...requiredProps, updateSection, activeSection: 'clock'};
        renderWithContext(<UserSettingsDisplay {...props}/>);

        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('should have called updateSection', async () => {
        const updateSection = jest.fn();

        const props = {...requiredProps, updateSection, activeSection: 'clock'};
        renderWithContext(<UserSettingsDisplay {...props}/>);

        // Click Save → handleSubmit → updateSection('')
        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(updateSection).toHaveBeenCalledWith('');

        // Click Cancel → updateSection is called again
        updateSection.mockClear();
        await userEvent.click(screen.getByTestId('cancelButton'));
        expect(updateSection).toHaveBeenCalled();
    });

    test('should have called closeModal', async () => {
        const closeModal = jest.fn();
        const props = {...requiredProps, closeModal};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        await userEvent.click(container.querySelector('#closeButton')!);
        expect(closeModal).toHaveBeenCalled();
    });

    test('should have called collapseModal', async () => {
        const collapseModal = jest.fn();
        const props = {...requiredProps, collapseModal};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        await userEvent.click(container.querySelector('.fa-angle-left')!);
        expect(collapseModal).toHaveBeenCalled();
    });

    test('should update militaryTime state', async () => {
        const props = {...requiredProps, activeSection: 'clock'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#clockFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#clockFormatB') as HTMLInputElement;

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();
    });

    test('should update teammateNameDisplay state', async () => {
        const props = {...requiredProps, activeSection: 'name_format'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#name_formatFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#name_formatFormatB') as HTMLInputElement;
        const radioC = container.querySelector('#name_formatFormatC') as HTMLInputElement;

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();

        await userEvent.click(radioC);
        expect(radioC).toBeChecked();
    });

    test('should update channelDisplayMode state', async () => {
        const props = {...requiredProps, activeSection: 'channel_display_mode'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#channel_display_modeFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#channel_display_modeFormatB') as HTMLInputElement;

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();
    });

    test('should update messageDisplay state', async () => {
        const props = {...requiredProps, activeSection: 'message_display'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#message_displayFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#message_displayFormatB') as HTMLInputElement;

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();
    });

    test('should update collapseDisplay state', async () => {
        const props = {...requiredProps, activeSection: 'collapse'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#collapseFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#collapseFormatB') as HTMLInputElement;

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();
    });

    test('should update linkPreviewDisplay state', async () => {
        const props = {...requiredProps, activeSection: 'linkpreview', enableLinkPreviews: true};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#linkpreviewFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#linkpreviewFormatB') as HTMLInputElement;

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();
    });

    test('should update display state', async () => {
        const props = {...requiredProps, activeSection: 'linkpreview', enableLinkPreviews: true};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        // Click radio buttons in the link preview section to test handleOnChange
        const radioA = container.querySelector('#linkpreviewFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#linkpreviewFormatB') as HTMLInputElement;

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();
    });

    test('should update collapsed reply threads state', async () => {
        const props = {...requiredProps, activeSection: 'collapsed_reply_threads', collapsedReplyThreadsAllowUserPreference: true};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#collapsed_reply_threadsFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#collapsed_reply_threadsFormatB') as HTMLInputElement;

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();
    });

    test('should update last active state', async () => {
        const props = {...requiredProps, activeSection: 'lastactive', lastActiveTimeEnabled: true};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const radioA = container.querySelector('#lastactiveFormatA') as HTMLInputElement;
        const radioB = container.querySelector('#lastactiveFormatB') as HTMLInputElement;

        await userEvent.click(radioB);
        expect(radioB).toBeChecked();

        await userEvent.click(radioA);
        expect(radioA).toBeChecked();
    });

    test('should not show last active section', () => {
        const {container} = renderWithContext(
            <UserSettingsDisplay
                {...requiredProps}
                lastActiveTimeEnabled={false}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
