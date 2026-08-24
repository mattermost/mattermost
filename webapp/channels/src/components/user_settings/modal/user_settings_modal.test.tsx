// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {act, renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';
import {applyTheme} from 'utils/utils';

import type {GlobalState} from 'types/store';

import UserSettingsModal from './index';

type Props = ComponentProps<typeof UserSettingsModal>;

const baseProps: Props = {
    isContentProductSettings: true,
    onExited: jest.fn(),
};

const baseState: DeepPartial<GlobalState> = {
    entities: {
        users: {
            currentUserId: 'id',
            profiles: {
                id: TestHelper.getUserMock({id: 'id'}),
            },
        },
    },
};

jest.mock('@mattermost/client', () => ({
    ...jest.requireActual('@mattermost/client'),
    Client4: class MockClient4 extends jest.requireActual('@mattermost/client').Client4 {
        getUserCustomProfileAttributesValues = jest.fn();
    },
}));

jest.mock('utils/url', () => ({
    ...jest.requireActual('utils/url'),
    isValidUrl: jest.fn((url = '') => (/^https?:\/\//i).test(url)),
}));

jest.mock('utils/utils', () => ({
    ...jest.requireActual('utils/utils'),
    applyTheme: jest.fn(),
}));

describe('do first render to avoid other testing issues', () => {
    // For some reason, the first time we render, the modal does not
    // completly renders. This makes it so further tests go properly
    // through.
    renderWithContext(<UserSettingsModal {...baseProps}/>, baseState);
});

describe('plugin tabs are only rendered on content product settings', () => {
    it('plugin tabs are properly rendered', async () => {
        const uiName1 = 'plugin_a';
        const uiName2 = 'plugin_b';
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName: uiName1,
                    },
                    plugin_b: {
                        id: 'plugin_b',
                        sections: [],
                        uiName: uiName2,
                    },
                },
            },
        };

        renderWithContext(
            <UserSettingsModal
                {...baseProps}
                isContentProductSettings={false}
            />,
            mergeObjects(baseState, state),
        );

        expect(screen.queryByText(uiName1)).not.toBeInTheDocument();
        expect(screen.queryByText(uiName2)).not.toBeInTheDocument();
    });
});

describe('tabs are properly rendered', () => {
    it('plugin tabs are properly rendered', async () => {
        const uiName1 = 'plugin_a';
        const uiName2 = 'plugin_b';
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName: uiName1,
                    },
                    plugin_b: {
                        id: 'plugin_b',
                        sections: [],
                        uiName: uiName2,
                    },
                },
            },
        };

        renderWithContext(<UserSettingsModal {...baseProps}/>, mergeObjects(baseState, state));

        expect(screen.queryByText(uiName1)).toBeInTheDocument();
        expect(screen.queryByText(uiName2)).toBeInTheDocument();
    });

    it('retains the plugin preferences heading for content product settings with plugin tabs', () => {
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName: 'plugin_a',
                    },
                },
            },
        };

        renderWithContext(<UserSettingsModal {...baseProps}/>, mergeObjects(baseState, state));

        expect(screen.getByText('PLUGIN PREFERENCES')).toBeInTheDocument();
    });

    it('plugin settings tabs can be selected', async () => {
        const uiName1 = 'plugin A';
        const uiName2 = 'plugin B';
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [
                            {
                                title: 'plugin A section',
                                settings: [
                                    {
                                        name: 'plugin A setting',
                                    },
                                ],
                            },
                        ],
                        uiName: uiName1,
                    },
                    plugin_b: {
                        id: 'plugin_b',
                        sections: [
                            {
                                title: 'plugin B section',
                                settings: [
                                    {
                                        name: 'plugin B setting',
                                    },
                                ],
                            },
                        ],
                        uiName: uiName2,
                    },
                },
            },
        };

        renderWithContext(
            <UserSettingsModal
                {...baseProps}
                activeTab='plugin_b'
            />,
            mergeObjects(baseState, state),
        );

        expect(screen.queryByText(uiName1)).toBeInTheDocument();
        expect(screen.queryByText(uiName2)).toBeInTheDocument();
        expect(screen.queryAllByText('plugin B Settings')).toHaveLength(2);
        expect(screen.queryByText('plugin A Settings')).not.toBeInTheDocument();
    });
});

describe('collapsing the settings pane on mobile', () => {
    it('hides the settings pane and clears the active tab', async () => {
        renderWithContext(<UserSettingsModal {...baseProps}/>, baseState);

        const modalDialog = document.querySelector('.settings-modal');
        expect(modalDialog).toBeInTheDocument();
        expect(modalDialog).not.toHaveClass('display--content');

        // Selecting a tab shows the settings pane over the tab list on mobile
        await userEvent.click(screen.getByRole('tab', {name: 'display'}));

        expect(modalDialog).toHaveClass('display--content');
        expect(screen.getByRole('tab', {name: 'display'})).toHaveAttribute('aria-selected', 'true');

        // Pressing back collapses the settings pane to show the tab list again
        await userEvent.click(screen.getByRole('button', {name: 'Collapse Icon'}));

        expect(modalDialog).not.toHaveClass('display--content');
        expect(screen.getByRole('tab', {name: 'display'})).toHaveAttribute('aria-selected', 'false');
    });
});

describe('discarding an unsaved theme preview', () => {
    const themeState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    EnableThemeSelection: 'true',
                },
            },
        },
    };

    // The GenericModal fade lasts 300ms and delayFocusTrap adds another 500ms
    const modalTeardownMs = 300 + 500;

    let user: ReturnType<typeof userEvent.setup>;
    let onExited: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
        onExited = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // Runs any pending modal fade transition to completion, so that a modal which is
    // on its way out has actually gone by the time the assertions run.
    const settleTransitions = () => act(() => {
        jest.advanceTimersByTime(modalTeardownMs);
    });

    const renderSettingsModal = () => renderWithContext(
        <UserSettingsModal
            {...baseProps}
            onExited={onExited}
        />,
        mergeObjects(baseState, themeState),
    );

    const openThemeSection = async () => {
        await user.click(screen.getByRole('tab', {name: 'display'}));
        await user.click(screen.getByRole('button', {name: 'Theme Edit'}));
    };

    const previewOnyxTheme = async () => {
        await openThemeSection();
        await user.click(screen.getByRole('button', {name: /Onyx/}));

        expect(screen.getByRole('button', {name: /Onyx/})).toHaveClass('active');
    };

    const settingsModal = () => document.getElementById('accountSettingsModal');
    const confirmDialog = () => document.getElementById('confirmModal');
    const discardMessage = () => screen.queryByText('You have unsaved changes, are you sure you want to discard them?');
    const closeSettingsModal = () => user.click(within(settingsModal()!).getByRole('button', {name: 'Close'}));

    it('keeps the settings modal open while the confirmation is unanswered', async () => {
        renderSettingsModal();

        await previewOnyxTheme();
        await closeSettingsModal();
        settleTransitions();

        expect(discardMessage()).toBeVisible();
        expect(settingsModal()).toBeInTheDocument();
        expect(onExited).not.toHaveBeenCalled();
        expect(applyTheme).toHaveBeenLastCalledWith(expect.objectContaining({type: 'Onyx'}));
    });

    it('keeps the settings modal and the previewed theme when the discard is cancelled', async () => {
        renderSettingsModal();

        await previewOnyxTheme();
        await closeSettingsModal();
        await user.click(within(confirmDialog()!).getByRole('button', {name: 'Cancel'}));
        settleTransitions();

        expect(discardMessage()).not.toBeInTheDocument();
        expect(settingsModal()).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Onyx/})).toHaveClass('active');
        expect(onExited).not.toHaveBeenCalled();
        expect(applyTheme).toHaveBeenLastCalledWith(expect.objectContaining({type: 'Onyx'}));

        // The preview is still unsaved, so closing again has to ask a second time
        await closeSettingsModal();

        expect(discardMessage()).toBeVisible();
    });

    it('closes the settings modal and reverts the theme when the discard is confirmed', async () => {
        renderSettingsModal();

        await previewOnyxTheme();
        await closeSettingsModal();
        await user.click(screen.getByRole('button', {name: 'Yes, Discard'}));
        settleTransitions();

        expect(settingsModal()).not.toBeInTheDocument();
        expect(onExited).toHaveBeenCalled();
        expect(applyTheme).toHaveBeenLastCalledWith(expect.objectContaining({type: 'Denim'}));
    });

    it('closes the settings modal without confirmation when the theme already in use is re-selected', async () => {
        renderSettingsModal();

        await openThemeSection();
        await user.click(screen.getByRole('button', {name: /Denim/}));
        await closeSettingsModal();

        // Asserted before the fade completes, since a confirmation that is wrongly shown here
        // gets torn down along with the closing settings modal
        expect(discardMessage()).not.toBeInTheDocument();

        settleTransitions();

        expect(settingsModal()).not.toBeInTheDocument();
        expect(onExited).toHaveBeenCalled();
    });

    // Saving is the one place that clears the unsaved-changes flag and immediately reads it back,
    // so this is also the guard against requireConfirm becoming asynchronous
    it('closes the settings modal without confirmation after the previewed theme is saved', async () => {
        renderSettingsModal();

        await previewOnyxTheme();
        await user.click(screen.getByRole('button', {name: 'Save', exact: true}));
        settleTransitions();

        // Saving collapses the theme section, and nothing is left to discard
        expect(discardMessage()).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Theme Edit'})).toBeVisible();

        await closeSettingsModal();

        expect(discardMessage()).not.toBeInTheDocument();

        settleTransitions();

        expect(settingsModal()).not.toBeInTheDocument();
        expect(onExited).toHaveBeenCalled();
    });
});

describe('plugin tabs use the correct icon', () => {
    it('use power plug when no icon', () => {
        const uiName = 'plugin_a';
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName,
                    },
                },
            },
        };

        renderWithContext(<UserSettingsModal {...baseProps}/>, mergeObjects(baseState, state));

        const element = screen.queryByTitle(uiName);
        expect(element).toBeInTheDocument();
        expect(element!.nodeName).toBe('I');
        expect(element?.className).toBe('icon icon-power-plug-outline');
    });

    it('use image when icon URL provided', () => {
        const uiName = 'plugin_a';
        const icon = 'http://localhost:8065/plugins/com.mattermost.plugin_a/public/icon.svg';
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName,
                        icon,
                    },
                },
            },
        };
        renderWithContext(<UserSettingsModal {...baseProps}/>, mergeObjects(baseState, state));

        const element = screen.queryByAltText(uiName);
        expect(element).toBeInTheDocument();
        expect(element!.nodeName).toBe('IMG');
        expect(element!.getAttribute('src')).toBe(icon);
    });

    it('use image when icon path provided', () => {
        const uiName = 'plugin_a';
        const icon = '/plugins/com.mattermost.plugin_a/public/icon.svg';
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName,
                        icon,
                    },
                },
            },
        };
        renderWithContext(<UserSettingsModal {...baseProps}/>, mergeObjects(baseState, state));

        const element = screen.queryByAltText(uiName);
        expect(element).toBeInTheDocument();
        expect(element!.nodeName).toBe('IMG');
        expect(element!.getAttribute('src')).toBe(icon);
    });

    it('prefixes root-relative icon paths with the base path', () => {
        const uiName = 'plugin_a';
        const icon = '/plugins/com.mattermost.plugin_a/public/icon.svg';
        const state: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {
                        SiteURL: 'http://localhost:8065/subpath',
                    },
                },
            },
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName,
                        icon,
                    },
                },
            },
        };
        renderWithContext(<UserSettingsModal {...baseProps}/>, mergeObjects(baseState, state));

        const element = screen.queryByAltText(uiName);
        expect(element).toBeInTheDocument();
        expect(element!.getAttribute('src')).toBe(`/subpath${icon}`);
    });

    it('use class name when icon name provided', () => {
        const uiName = 'plugin_a';
        const icon = 'icon-phone-in-talk';
        const state: DeepPartial<GlobalState> = {
            plugins: {
                userSettings: {
                    plugin_a: {
                        id: 'plugin_a',
                        sections: [],
                        uiName,
                        icon,
                    },
                },
            },
        };

        renderWithContext(<UserSettingsModal {...baseProps}/>, mergeObjects(baseState, state));

        const element = screen.queryByTitle(uiName);
        expect(element).toBeInTheDocument();
        expect(element!.nodeName).toBe('I');
        expect(element?.className).toBe('icon icon-phone-in-talk');
    });
});
