// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Placement} from '@floating-ui/react';
import React, {type JSX} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {ChevronLeftIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {PunchOutCoordsHeightAndWidth} from '@mattermost/components';
import {TourTip} from '@mattermost/components';

import {useTourTipManager} from './tour_manager';
import {getLastStep} from './utils';

// TODO MM-51399 These strings are properly defined in @mattermost/components, but the i18n tooling currently can't
// find them there, so we've had to redefine them here
defineMessages({
    optOut: {
        id: 'tutorial_tip.out',
        defaultMessage: 'Opt out of these tips.',
    },
    seenBefore: {
        id: 'tutorial_tip.seen',
        defaultMessage: 'Seen this before? ',
    },
});

export type ChannelsTourTipProps = {
    screen: JSX.Element;
    title: JSX.Element;
    imageURL?: string;
    overlayPunchOut: PunchOutCoordsHeightAndWidth | null;
    singleTip?: boolean;
    placement?: Placement;
    pulsatingDotPlacement?: Omit<Placement, 'auto' | 'auto-end'>;
    pulsatingDotTranslate?: {x: number; y: number};
    offset?: [number, number];
    width?: string | number;
    tourCategory: string;
    hideBackdrop?: boolean;
    tippyBlueStyle?: boolean;
    showOptOut?: boolean;
    interactivePunchOut?: boolean;
};

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
        <FormattedMessage
            id='generic.previous'
            defaultMessage='Previous'
        />
    );

    const lastStep = getLastStep(tourSteps);
    let nextBtn = (
        <FormattedMessage
            id='tutorial_tip.ok'
            defaultMessage='Next'
        />
    );
    let nextTrailingGlyph: JSX.Element | undefined = <ChevronRightIcon/>;
    if (singleTip) {
        nextBtn = (
            <FormattedMessage
                id='tutorial_tip.got_it'
                defaultMessage='Got it'
            />
        );
        nextTrailingGlyph = undefined;
    } else if (currentStep === lastStep) {
        nextBtn = (
            <FormattedMessage
                id='tutorial_tip.done'
                defaultMessage='Done'
            />
        );
        nextTrailingGlyph = undefined;
    }

    return (
        <TourTip
            show={show}
            tourSteps={tourSteps}
            title={title}
            screen={screen}
            singleTip={singleTip}
            imageURL={imageURL}
            overlayPunchOut={overlayPunchOut}
            nextBtn={nextBtn}
            nextTrailingGlyph={nextTrailingGlyph}
            prevBtn={singleTip ? undefined : prevBtn}
            prevLeadingGlyph={singleTip ? undefined : <ChevronLeftIcon/>}
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
