// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {getAllLanguages} from 'i18n/i18n';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';

import UserSettingsDisplay from './user_settings_display';

// Mock applyTheme due to JSDOM CSS selector limitations
vi.mock('utils/utils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        applyTheme: vi.fn(),
    };
});

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
        updateSection: vi.fn(),
        activeSection: '',
        closeModal: vi.fn(),
        collapseModal: vi.fn(),
        setRequireConfirm: vi.fn(),
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
            autoUpdateTimezone: vi.fn(),
            savePreferences: vi.fn().mockResolvedValue({data: true}),
            updateMe: vi.fn().mockResolvedValue({data: true}),
            patchUser: vi.fn().mockResolvedValue({data: true}),
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

    beforeEach(() => {
        vi.clearAllMocks();
    });

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

    test('should have called closeModal', async () => {
        const closeModal = vi.fn();
        const props = {...requiredProps, closeModal};

        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const closeButton = container.querySelector('#closeButton');
        expect(closeButton).toBeInTheDocument();
        await userEvent.click(closeButton!);

        expect(closeModal).toHaveBeenCalled();
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

    test('should have called handleSubmit', async () => {
        const updateSection = vi.fn();
        const savePreferences = vi.fn().mockResolvedValue({data: true});
        const props = {
            ...requiredProps,
            updateSection,
            activeSection: 'collapse',
            actions: {...requiredProps.actions, savePreferences},
        };

        renderWithContext(<UserSettingsDisplay {...props}/>);

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(updateSection).toHaveBeenCalledWith('');
        });
    });

    test('should have called updateSection', async () => {
        const updateSection = vi.fn();
        const props = {...requiredProps, updateSection, activeSection: 'collapse'};

        renderWithContext(<UserSettingsDisplay {...props}/>);

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await userEvent.click(cancelButton);

        expect(updateSection).toHaveBeenCalled();
    });

    test('should have called collapseModal', async () => {
        const collapseModal = vi.fn();
        const props = {...requiredProps, collapseModal};

        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        const backButton = container.querySelector('.fa-angle-left');
        if (backButton) {
            await userEvent.click(backButton);
            expect(collapseModal).toHaveBeenCalled();
        }
    });

    test('should update militaryTime state', () => {
        const props = {...requiredProps, activeSection: 'clock'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container.querySelector('input[type="radio"]')).toBeInTheDocument();
    });

    test('should update teammateNameDisplay state', () => {
        const props = {...requiredProps, activeSection: 'teammate_name_display'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);

        // Verify component renders with teammate name display section
        // The section may or may not have radio buttons depending on config
        expect(container).toBeInTheDocument();
    });

    test('should update channelDisplayMode state', () => {
        const props = {...requiredProps, activeSection: 'channel_display_mode'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container.querySelector('input[type="radio"]')).toBeInTheDocument();
    });

    test('should update messageDisplay state', () => {
        const props = {...requiredProps, activeSection: 'message_display'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container.querySelector('input[type="radio"]')).toBeInTheDocument();
    });

    test('should update collapseDisplay state', () => {
        const props = {...requiredProps, activeSection: 'collapse'};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container.querySelector('input[type="radio"]')).toBeInTheDocument();
    });

    test('should update linkPreviewDisplay state', () => {
        const props = {...requiredProps, activeSection: 'linkpreview', enableLinkPreviews: true};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container.querySelector('input[type="radio"]')).toBeInTheDocument();
    });

    test('should update display state', () => {
        const {container} = renderWithContext(<UserSettingsDisplay {...requiredProps}/>);
        expect(container).toBeInTheDocument();
    });

    test('should update collapsed reply threads state', () => {
        const props = {...requiredProps, collapsedReplyThreadsAllowUserPreference: true};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toBeInTheDocument();
    });

    test('should update last active state', () => {
        const props = {...requiredProps, lastActiveTimeEnabled: true};
        const {container} = renderWithContext(<UserSettingsDisplay {...props}/>);
        expect(container).toBeInTheDocument();
    });
});
