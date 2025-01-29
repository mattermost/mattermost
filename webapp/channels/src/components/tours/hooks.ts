// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';

import {close as closeLhs, open as openLhs} from 'actions/views/lhs';
import {switchToChannels} from 'actions/views/onboarding_tasks';

import {openMenu, dismissMenu} from 'components/menu';
import {OnboardingTaskCategory, OnboardingTaskList, OnboardingTasksName} from 'components/onboarding_tasks';
import {ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU} from 'components/sidebar/sidebar_header/sidebar_browse_or_add_channel_menu';

import {getHistory} from 'utils/browser_history';

import type {GlobalState} from 'types/store';

import {
    CrtTutorialSteps,
    FINISHED,
    OnboardingTourSteps,
    TTNameMapToTourSteps,
    TutorialTourName,
} from './constant';

export const useGetTourSteps = (tourCategory: string) => {
    const isGuestUser = useSelector((state: GlobalState) => isCurrentUserGuestUser(state));

    let tourSteps: Record<string, number> = TTNameMapToTourSteps[tourCategory];

    if (tourCategory === TutorialTourName.ONBOARDING_TUTORIAL_STEP && isGuestUser) {
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
                openMenu(ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU);
                break;
            }
            case OnboardingTourSteps.INVITE_PEOPLE : {
                openMenu(ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU);
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
        }
    }, [currentUserId, teamUrl, tourCategory]);

    const lastStepActions = useCallback((lastStep: number) => {
        if (tourCategory === TutorialTourName.ONBOARDING_TUTORIAL_STEP) {
            switch (lastStep) {
            case OnboardingTourSteps.CREATE_AND_JOIN_CHANNELS : {
                dismissMenu();
                break;
            }
            case OnboardingTourSteps.INVITE_PEOPLE : {
                dismissMenu();
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
