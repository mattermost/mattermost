// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {
    GenericTaskSteps,
    OnboardingTaskCategory,
    OnboardingTasksName,
} from 'components/onboarding_tasks';
import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link';
import {OnboardingTourSteps, TutorialTourName} from 'components/tours';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

// Stub the tour tip so the assertion targets the config-driven decision to render it,
// not the internals of the shared TourTip component.
jest.mock('components/tours/onboarding_tour', () => ({
    ...jest.requireActual('components/tours/onboarding_tour'),
    ChannelsAndDirectMessagesTour: () => <div data-testid='channels-tour-tip'/>,
}));

describe('components/sidebar/sidebar_channel_link - EnableTutorial effect', () => {
    const currentUserId = 'current_user_id';

    const townSquare = {
        id: 'town_square_channel_id',
        display_name: 'Town Square',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        team_id: 'team_id',
        type: 'O' as ChannelType,
        name: Constants.DEFAULT_CHANNEL,
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: '',
        scheme_id: '',
        group_constrained: false,
    };

    const ownProps = {
        channel: townSquare,
        link: '/team/channels/town-square',
        label: 'Town Square',
        icon: null,
        isSharedChannel: false,
    };

    // A state where the Channels tour tip is armed: the user is on the channels tour
    // step and the onboarding task has been triggered. The only remaining gate is
    // the ServiceSettings.EnableTutorial config value.
    const armedTutorialState = (enableTutorial: string) => ({
        entities: {
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {id: currentUserId, roles: 'system_user'},
                },
            },
            general: {
                config: {
                    EnableTutorial: enableTutorial,
                    EnableOnboardingFlow: 'true',
                },
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(TutorialTourName.ONBOARDING_TUTORIAL_STEP, currentUserId)]: {
                        category: TutorialTourName.ONBOARDING_TUTORIAL_STEP,
                        name: currentUserId,
                        user_id: currentUserId,
                        value: String(OnboardingTourSteps.CHANNELS_AND_DIRECT_MESSAGES),
                    },
                    [getPreferenceKey(OnboardingTaskCategory, OnboardingTasksName.CHANNELS_TOUR)]: {
                        category: OnboardingTaskCategory,
                        name: OnboardingTasksName.CHANNELS_TOUR,
                        user_id: currentUserId,
                        value: String(GenericTaskSteps.STARTED),
                    },
                },
            },
        },
    });

    test('shows the Channels tour tip when EnableTutorial is true', () => {
        renderWithContext(<SidebarChannelLink {...ownProps}/>, armedTutorialState('true'));

        expect(screen.getByTestId('channels-tour-tip')).toBeInTheDocument();
    });

    test('hides the Channels tour tip when EnableTutorial is false', () => {
        renderWithContext(<SidebarChannelLink {...ownProps}/>, armedTutorialState('false'));

        expect(screen.queryByTestId('channels-tour-tip')).not.toBeInTheDocument();
    });
});
