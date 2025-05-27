// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {TourTip, useMeasurePunchouts} from '@mattermost/components';

import {setShowOnboardingVisitConsoleTour} from 'actions/views/onboarding_tasks';
import {isShowOnboardingVisitConsoleTour} from 'selectors/views/onboarding_tasks';

import {ELEMENT_ID_FOR_PRODUCT_SWITCHER_MENU} from 'components/global_header/left_controls/product_switcher_menu';

import {OnboardingTasksName, TaskNameMapToSteps} from './constants';
import {useHandleOnBoardingTaskData} from './onboarding_tasks_manager';

const translate = {x: -8, y: 2};

export const VisitSystemConsoleTour = () => {
    const dispatch = useDispatch();
    const handleTask = useHandleOnBoardingTaskData();
    const taskName = OnboardingTasksName.VISIT_SYSTEM_CONSOLE;
    const steps = TaskNameMapToSteps[taskName];
    const isOpen = useSelector(isShowOnboardingVisitConsoleTour);

    useEffect(() => {
        return () => {
            dispatch(setShowOnboardingVisitConsoleTour(false));
        };
    }, []);

    const title = (
        <FormattedMessage
            id='onboardingTask.visitSystemConsole.title'
            defaultMessage={'Visit the System Console'}
        />
    );
    const screen = (
        <p>
            <FormattedMessage
                id='onboardingTask.visitSystemConsole.Description'
                defaultMessage={'More detailed configuration settings for your workspace can be accessed here.'}
            />
        </p>
    );

    const overlayPunchOut = useMeasurePunchouts([ELEMENT_ID_FOR_PRODUCT_SWITCHER_MENU], []);

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
            pulsatingDotPlacement='right'
            pulsatingDotTranslate={translate}
            handleDismiss={onDismiss}
            singleTip={true}
            showOptOut={false}
            interactivePunchOut={true}
        />
    );
};
