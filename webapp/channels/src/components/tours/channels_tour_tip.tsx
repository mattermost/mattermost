// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TourTip, PunchOutCoordsHeightAndWidth} from '@mattermost/components';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Placement} from 'tippy.js';

import {t} from 'utils/i18n';

import {useTourTipManager} from './tour_manager';
import {getLastStep} from './utils';

// TODO MM-51399 These strings are properly defined in @mattermost/components, but the i18n tooling currently can't
// find them there, so we've had to redefine them here
t('tutorial_tip.out');
t('tutorial_tip.seen');

export type ChannelsTourTipProps = {
    screen: JSX.Element;
    title: JSX.Element;
    imageURL?: string;
    overlayPunchOut: PunchOutCoordsHeightAndWidth | null;
    singleTip?: boolean;
    placement?: Placement;
    pulsatingDotPlacement?: Omit<Placement, 'auto'| 'auto-end'>;
    pulsatingDotTranslate?: {x: number; y: number};
    offset?: [number, number];
    width?: string | number;
    tourCategory: string;
    hideBackdrop?: boolean;
    tippyBlueStyle?: boolean;
    showOptOut?: boolean;
    interactivePunchOut?: boolean;
}

export const ChannelsTourTip = ({
    title,
    screen,
    imageURL,
    overlayPunchOut,
    singleTip,
    pulsatingDotTranslate,
    pulsatingDotPlacement,
    offset = [-18, 4],
    placement = 'right-start',
    width = 320,
    tourCategory,
    hideBackdrop = false,
    tippyBlueStyle = false,
    showOptOut = true,
    interactivePunchOut = false,
}: ChannelsTourTipProps) => {
    const {
        show,
        currentStep,
        tourSteps,
        handleOpen,
        handleDismiss,
        handleNext,
        handlePrevious,
        handleSkip,
        handleJump,
    } = useTourTipManager(tourCategory);

    const prevBtn = (
        <>
            <i className='icon icon-chevron-left'/>
            <FormattedMessage
                id='generic.previous'
                defaultMessage='Previous'
            />
        </>
    );

    const nextBtn = (): JSX.Element => {
        let buttonText = (
            <>
                <FormattedMessage
                    id={'tutorial_tip.ok'}
                    defaultMessage={'Next'}
                />
                <i className='icon icon-chevron-right'/>
            </>
        );
        if (singleTip) {
            buttonText = (
                <FormattedMessage
                    id={'tutorial_tip.got_it'}
                    defaultMessage={'Got it'}
                />
            );
            return buttonText;
        }

        const lastStep = getLastStep(tourSteps);
        if (currentStep === lastStep) {
            buttonText = (
                <FormattedMessage
                    id={'tutorial_tip.done'}
                    defaultMessage={'Done'}
                />
            );
        }
        return buttonText;
    };

    return (
        <TourTip
            show={show}
            tourSteps={tourSteps}
            title={title}
            screen={screen}
            singleTip={singleTip}
            imageURL={imageURL}
            overlayPunchOut={overlayPunchOut}
            nextBtn={nextBtn()}
            prevBtn={singleTip ? undefined : prevBtn}
            step={currentStep}
            placement={placement}
            pulsatingDotPlacement={pulsatingDotPlacement}
            pulsatingDotTranslate={pulsatingDotTranslate}
            width={width}
            offset={offset}
            handleOpen={handleOpen}
            handleDismiss={handleDismiss}
            handleNext={handleNext}
            handlePrevious={handlePrevious}
            handleSkip={handleSkip}
            handleJump={handleJump}
            hideBackdrop={hideBackdrop}
            tippyBlueStyle={tippyBlueStyle}
            showOptOut={showOptOut}
            interactivePunchOut={interactivePunchOut}
        />
    );
};
