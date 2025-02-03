// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {AutoSizerProps} from 'react-virtualized-auto-sizer';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Preferences} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import CustomStatusModal from './custom_status_modal';

jest.mock('react-virtualized-auto-sizer', () => (props: AutoSizerProps) => props.children({height: 100, width: 100}));
jest.mock('images/img_trans.gif', () => 'img_trans.gif');

describe('CustomStatusModal', () => {
    const baseProps = {
        onExited: jest.fn(),
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    EnableCustomEmoji: 'true',
                    EnableCustomUserStatuses: 'true',
                },
            },
        },
    };

    // The emoji picker renders emoji categories without passing a defaultMessage, and we don't pass translation strings
    // into the provider by default, so we need to pass something for this string to silence errors from FormatJS.
    const renderOptions = {
        intlMessages: {
            'emoji_picker.smileys-emotion': 'Smileys & Emotions',
        },
    };

    test('should render suggested statuses until the user starts typing', () => {
        renderWithContext(
            <CustomStatusModal
                {...baseProps}
            />,
            initialState,
            renderOptions,
        );

        expect(screen.getByText('SUGGESTIONS')).toBeInTheDocument();
        expect(screen.getByText('Out for lunch')).toBeInTheDocument();
        expect(screen.getByLabelText(':hamburger:')).toBeInTheDocument();

        userEvent.type(screen.getByPlaceholderText('Set a status'), 'Test status, please ignore');

        expect(screen.queryByText('SUGGESTIONS')).not.toBeInTheDocument();
        expect(screen.queryByText('Out for lunch')).not.toBeInTheDocument();
        expect(screen.queryByLabelText(':hamburger:')).not.toBeInTheDocument();
    });

    test('should render suggested statuses until the user selects an emoji', () => {
        renderWithContext(
            <CustomStatusModal
                {...baseProps}
            />,
            initialState,
            renderOptions,
        );

        expect(screen.getByText('SUGGESTIONS')).toBeInTheDocument();
        expect(screen.getByLabelText(':hamburger:')).toBeInTheDocument();
        expect(screen.getByText('Out for lunch')).toBeInTheDocument();

        userEvent.click(screen.getByLabelText('select an emoji'));
        act(() => userEvent.click(screen.getByLabelText('grinning emoji')));

        expect(screen.queryByText('SUGGESTIONS')).not.toBeInTheDocument();
        expect(screen.queryByText('Out for lunch')).not.toBeInTheDocument();
        expect(screen.queryByLabelText(':hamburger:')).not.toBeInTheDocument();
    });

    test('should render recently used statuses as suggestions', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.CATEGORY_CUSTOM_STATUS,
                            name: Preferences.NAME_RECENT_CUSTOM_STATUSES,
                            value: JSON.stringify([
                                TestHelper.getCustomStatusMock({emoji: 'taco', text: 'Eating a taco'}),
                            ]),
                        },
                    ]),
                },
            },
        });

        renderWithContext(
            <CustomStatusModal
                {...baseProps}
            />,
            testState,
            renderOptions,
        );

        expect(screen.getByText('SUGGESTIONS')).toBeInTheDocument();
        expect(screen.getByText('Eating a taco')).toBeInTheDocument();
        expect(screen.getByLabelText(':taco:')).toBeInTheDocument();
    });

    test('should render recently used statuses with custom emojis which exist', () => {
        const existentEmoji = TestHelper.getCustomEmojiMock({name: 'existent'});

        const testState = mergeObjects(initialState, {
            entities: {
                emojis: {
                    customEmoji: {
                        [existentEmoji.id]: existentEmoji,
                    },
                },
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.CATEGORY_CUSTOM_STATUS,
                            name: Preferences.NAME_RECENT_CUSTOM_STATUSES,
                            value: JSON.stringify([
                                TestHelper.getCustomStatusMock({emoji: 'existent', text: 'Existing'}),
                                TestHelper.getCustomStatusMock({emoji: 'nonexistent', text: 'Not existing'}),
                            ]),
                        },
                    ]),
                },
            },
        });

        renderWithContext(
            <CustomStatusModal
                {...baseProps}
            />,
            testState,
            renderOptions,
        );

        expect(screen.getByText('SUGGESTIONS')).toBeInTheDocument();
        expect(screen.getByText('Existing')).toBeInTheDocument();
        expect(screen.getByLabelText(':existent:')).toBeInTheDocument();
        expect(screen.queryByText('Not existing')).not.toBeInTheDocument();
        expect(screen.queryByLabelText(':nonexistent:')).not.toBeInTheDocument();
    });
});
