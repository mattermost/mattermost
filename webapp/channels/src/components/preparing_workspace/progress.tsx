// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {CSSTransition} from 'react-transition-group';

import PaginationDots from 'components/common/pagination_dots';

import {WizardSteps} from './steps';
import type {WizardStep} from './steps';

import './progress.scss';

type Props = {
    step: WizardStep;
    stepOrder: WizardStep[];
    transitionSpeed: number;
};

export const Progress = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
    const visibleSteps = props.stepOrder.filter((step) => step !== WizardSteps.LaunchingWorkspace);
    const totalSteps = visibleSteps.length;
    if (totalSteps < 2) {
        return null;
    }

    const activeStepIndex = visibleSteps.indexOf(props.step);
    const currentStep = activeStepIndex >= 0 ? activeStepIndex + 1 : 1;

    return (
        <div
            ref={ref}
            className='PreparingWorkspaceProgress'
        >
            <PaginationDots
                totalSteps={totalSteps}
                currentStep={currentStep}
                orientation='vertical'
            />
        </div>
    );
});
Progress.displayName = 'Progress';

export default function TransitionedProgress(props: Props) {
    const nodeRef = useRef<HTMLDivElement>(null);

    return (
        <CSSTransition
            in={props.step !== WizardSteps.LaunchingWorkspace}
            nodeRef={nodeRef}
            timeout={props.transitionSpeed}
            classNames={'OnboardingWizardProgress'}
            mountOnEnter={true}
            unmountOnExit={true}
        >
            <Progress
                {...props}
                ref={nodeRef}
            />
        </CSSTransition>
    );
}
