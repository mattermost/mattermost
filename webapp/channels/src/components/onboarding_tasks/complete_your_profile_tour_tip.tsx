// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {TourTip, useMeasurePunchouts} from '@mattermost/components';

import {setShowOnboardingCompleteProfileTour} from 'actions/views/onboarding_tasks';
import {isShowOnboardingCompleteProfileTour} from 'selectors/views/onboarding_tasks';

import {ELEMENT_ID_FOR_USER_ACCOUNT_MENU} from 'components/user_account_menu/user_account_menu';

import {OnboardingTasksName, TaskNameMapToSteps} from './constants';
import {useHandleOnBoardingTaskData} from './onboarding_tasks_manager';

const translate = {x: 1.5, y: -9};

export const CompleteYourProfileTour = () => {
    const dispatch = useDispatch();
    const handleTask = useHandleOnBoardingTaskData();
    const taskName = OnboardingTasksName.COMPLETE_YOUR_PROFILE;
    const steps = TaskNameMapToSteps[taskName];
    const isOpen = useSelector(isShowOnboardingCompleteProfileTour);

    useEffect(() => {
        return () => {
            dispatch(setShowOnboardingCompleteProfileTour(false));
        };
    }, []);

    const title = (
        <FormattedMessage
            id='onboardingTask.completeYourProfileTour.title'
            defaultMessage={'Edit your profile'}
        />
    );
    const screen = (
        <p>
            <FormattedMessage
                id='onboardingTask.completeYourProfileTour.Description'
                defaultMessage={'Use this menu item to update your profile details and security settings.'}
            />
        </p>
    );

    const overlayPunchOut = useMeasurePunchouts([ELEMENT_ID_FOR_USER_ACCOUNT_MENU], [], {x: -2.5, y: -2.5, width: 5, height: 5});
    const onDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        handleTask(taskName, steps.START, true, 'dismiss');
    };

    return (
        <TourTip
            show={isOpen}
            title={title}
            screen={screen}
            overlayPunchOut={overlayPunchOut}
            step={steps.STARTED}
            placement='left-start'
            pulsatingDotPlacement='left-end'
            pulsatingDotTranslate={translate}
            handleDismiss={onDismiss}
            singleTip={true}
            showOptOut={false}
            interactivePunchOut={true}
        />
    );
};
