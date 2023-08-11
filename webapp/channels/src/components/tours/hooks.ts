// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';

import {setAddChannelDropdown} from 'actions/views/add_channel_dropdown';
import {close as closeLhs, open as openLhs} from 'actions/views/lhs';
import {switchToChannels} from 'actions/views/onboarding_tasks';
import {setProductMenuSwitcherOpen} from 'actions/views/product_menu';

import {OnboardingTaskCategory, OnboardingTaskList, OnboardingTasksName} from 'components/onboarding_tasks';

import {useGetPluginsActivationState} from 'plugins/useGetPluginsActivationState';
import type {GlobalState} from 'types/store';
import {getHistory} from 'utils/browser_history';

import {
    CrtTutorialSteps,
    ExploreOtherToolsTourSteps,
    FINISHED,
    OnboardingTourSteps,
    TTNameMapToTourSteps,
    TutorialTourName,
} from './constant';

export const useGetTourSteps = (tourCategory: string) => {
    const isGuestUser = useSelector((state: GlobalState) => isCurrentUserGuestUser(state));

    let tourSteps: Record<string, number> = TTNameMapToTourSteps[tourCategory];

    const {playbooksPlugin, playbooksProductEnabled, boardsPlugin} = useGetPluginsActivationState();

    if (tourCategory === TutorialTourName.EXPLORE_OTHER_TOOLS) {
        const steps: Record<string, number> = tourSteps as typeof ExploreOtherToolsTourSteps;
        if (!playbooksPlugin && !playbooksProductEnabled) {
            delete steps.PLAYBOOKS_TOUR;
        }

        if (!boardsPlugin) {
            delete steps.BOARDS_TOUR;
        }
        tourSteps = steps;
    } else if (tourCategory === TutorialTourName.ONBOARDING_TUTORIAL_STEP && isGuestUser) {
        // restrict the 'learn more about messaging' tour when user is guest (townSquare, channel creation and user invite are restricted to guests)
        tourSteps = TTNameMapToTourSteps[TutorialTourName.ONBOARDING_TUTORIAL_STEP_FOR_GUESTS];
    }
    return tourSteps;
};

export const useHandleNavigationAndExtraActions = (tourCategory: string) => {
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const teamUrl = useSelector((state: GlobalState) => getCurrentRelativeTeamUrl(state));

    const nextStepActions = useCallback((step: number) => {
        if (tourCategory === TutorialTourName.ONBOARDING_TUTORIAL_STEP) {
            switch (step) {
            case OnboardingTourSteps.CHANNELS_AND_DIRECT_MESSAGES : {
                dispatch(openLhs());
                break;
            }
            case OnboardingTourSteps.CREATE_AND_JOIN_CHANNELS : {
                dispatch(setAddChannelDropdown(true));
                break;
            }
            case OnboardingTourSteps.INVITE_PEOPLE : {
                dispatch(setAddChannelDropdown(true));
                break;
            }
            case OnboardingTourSteps.SEND_MESSAGE : {
                dispatch(switchToChannels());
                break;
            }
            case OnboardingTourSteps.FINISHED: {
                let preferences = [
                    {
                        user_id: currentUserId,
                        category: OnboardingTaskCategory,
                        name: OnboardingTasksName.CHANNELS_TOUR,
                        value: FINISHED.toString(),
                    },
                ];
                preferences = [...preferences,
                    {
                        user_id: currentUserId,
                        category: OnboardingTaskCategory,
                        name: OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN,
                        value: 'true',
                    },
                ];
                dispatch(savePreferences(currentUserId, preferences));
                break;
            }
            default:
            }
        } else if (tourCategory === TutorialTourName.CRT_TUTORIAL_STEP) {
            switch (step) {
            case CrtTutorialSteps.WELCOME_POPOVER : {
                dispatch(openLhs());
                break;
            }
            case CrtTutorialSteps.LIST_POPOVER : {
                const nextUrl = `${teamUrl}/threads`;
                getHistory().push(nextUrl);
                break;
            }
            case CrtTutorialSteps.UNREAD_POPOVER : {
                break;
            }
            default:
            }
        } else if (tourCategory === TutorialTourName.EXPLORE_OTHER_TOOLS) {
            switch (step) {
            case ExploreOtherToolsTourSteps.FINISHED : {
                dispatch(setProductMenuSwitcherOpen(false));
                let preferences = [
                    {
                        user_id: currentUserId,
                        category: OnboardingTaskCategory,
                        name: OnboardingTasksName.EXPLORE_OTHER_TOOLS,
                        value: FINISHED.toString(),
                    },
                ];
                preferences = [...preferences,
                    {
                        user_id: currentUserId,
                        category: OnboardingTaskCategory,
                        name: OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN,
                        value: 'true',
                    },
                ];
                dispatch(savePreferences(currentUserId, preferences));
                break;
            }
            default:
            }
        }
    }, [currentUserId, teamUrl, tourCategory]);

    const lastStepActions = useCallback((lastStep: number) => {
        if (tourCategory === TutorialTourName.ONBOARDING_TUTORIAL_STEP) {
            switch (lastStep) {
            case OnboardingTourSteps.CREATE_AND_JOIN_CHANNELS : {
                dispatch(setAddChannelDropdown(false));
                break;
            }
            case OnboardingTourSteps.INVITE_PEOPLE : {
                dispatch(setAddChannelDropdown(false));
                break;
            }
            default:
            }
        } else if (tourCategory === TutorialTourName.CRT_TUTORIAL_STEP) {
            switch (lastStep) {
            case CrtTutorialSteps.WELCOME_POPOVER : {
                dispatch(closeLhs());
                break;
            }
            default:
            }
        }
    }, [currentUserId, tourCategory]);

    return useCallback((step: number, lastStep: number) => {
        lastStepActions(lastStep);
        nextStepActions(step);
    }, [nextStepActions, lastStepActions]);
};
