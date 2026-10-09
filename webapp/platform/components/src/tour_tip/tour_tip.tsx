// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useFloating,
    autoUpdate,
    offset as floatingOffset,
    flip,
    shift,
    FloatingPortal,
    useTransitionStyles,
    type Placement,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useId, type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {TourPoint} from '@mattermost/compass-ui/components/tour-point';
import {Button} from '@mattermost/shared/components/button';

import {placementToPointerPosition} from './placement_to_pointer_position';
import {TourTipBackdrop} from './tour_tip_backdrop';

import type {Props as PunchOutCoordsHeightAndWidth} from '../common/hooks/useMeasurePunchouts';
import {PulsatingDot} from '../pulsating_dot';

import './tour_tip.scss';

export type TourTipEventSource = 'next' | 'prev' | 'dismiss' | 'jump' | 'skipped' | 'open' | 'punchOut';

// If this needs to alter, change in _variables $z-index-tour-tips-popover as well
const DEFAULT_Z_INDEX_TOUR_TIPS_POPOVER = 1300;
const ROOT_PORTAL_ID = 'root-portal';
const TRANSITION_STYLE_PROPS = {
    duration: {
        open: 250,
        close: 150,
    },
    initial: {
        opacity: 0,
        transform: 'scale(0.96)',
    },
};

type Props = {
    show: boolean;
    screen: JSX.Element;
    title: JSX.Element;
    step: number;

    tourSteps?: Record<string, number>;
    nextBtn?: JSX.Element;
    prevBtn?: JSX.Element;
    imageURL?: string;
    singleTip?: boolean;
    showOptOut?: boolean;
    placement?: Placement;
    pulsatingDotPlacement?: Omit<Placement, 'auto' | 'auto-end'>;
    pulsatingDotTranslate?: {x: number; y: number};
    offset?: [number, number];
    width?: string | number;
    zIndex?: number;
    className?: string;
    hideBackdrop?: boolean;
    tippyBlueStyle?: boolean;

    // if you don't want punchOut just assign null, keep null as hook may return null first than actual value
    overlayPunchOut: PunchOutCoordsHeightAndWidth | null;

    // if we want to interact with element visible via punchOut
    interactivePunchOut?: boolean;

    handleOpen?: (e: React.MouseEvent) => void;
    handleNext?: (e: React.MouseEvent) => void;
    handlePrevious?: (e: React.MouseEvent) => void;
    handleJump?: (e: React.MouseEvent, jumpToStep: number) => void;
    handleSkip?: (e: React.MouseEvent) => void;
    handleDismiss?: (e: React.MouseEvent) => void;
    handlePunchOut?: (e: React.MouseEvent) => void;
};

export const TourTip = ({
    title,
    screen,
    imageURL,
    overlayPunchOut,
    singleTip,
    step,
    show,
    interactivePunchOut,
    tourSteps,
    handleOpen,
    handleDismiss,
    handleNext,
    handlePrevious,
    handleSkip,
    handleJump,
    handlePunchOut,
    pulsatingDotTranslate,
    pulsatingDotPlacement,
    nextBtn,
    prevBtn,
    className,
    offset: tipOffset = [-18, 4],
    placement = 'right-start',
    showOptOut = true,
    width = 352,
    zIndex = DEFAULT_Z_INDEX_TOUR_TIPS_POPOVER,
    hideBackdrop = false,
    tippyBlueStyle = false,
}: Props) => {
    const titleId = useId();
    const {formatMessage} = useIntl();

    const rootPortal = document.getElementById(ROOT_PORTAL_ID);
    const backdropPortal = rootPortal ?? document.body;

    const {
        refs: {setReference, setFloating},
        floatingStyles,
        context: floatingContext,
        placement: resolvedPlacement,
    } = useFloating({
        open: show,
        whileElementsMounted: autoUpdate,
        placement,
        middleware: [
            floatingOffset({
                crossAxis: tipOffset[0],
                mainAxis: tipOffset[1],
            }),
            flip(),
            shift({padding: 8}),
        ],
    });
    const {isMounted, styles: transitionStyles} = useTransitionStyles(
        floatingContext,
        TRANSITION_STYLE_PROPS,
    );

    const combinedTransform = [
        floatingStyles.transform,
        transitionStyles.transform,
    ].filter(Boolean).join(' ');

    const tourStepCount = tourSteps ? Object.values(tourSteps).length - 1 : 0;
    const showProgress = !singleTip && tourSteps && tourStepCount > 0;

    const pointerPosition = placementToPointerPosition(resolvedPlacement);

    const invokeMouseHandler = (handler?: (e: React.MouseEvent) => void) => {
        if (!handler) {
            return undefined;
        }
        return () => handler({} as React.MouseEvent);
    };

    const showHostFooter = Boolean((step !== 0 && prevBtn) || showOptOut);

    return (
        <>
            <div
                id='tipButton'
                ref={setReference}
                onClick={handleOpen}
                className='tour-tip__pulsating-dot-ctr'
                data-pulsating-dot-placement={pulsatingDotPlacement || 'right'}
                style={{
                    transform: pulsatingDotTranslate ?
                        `translate(${pulsatingDotTranslate.x}px, ${pulsatingDotTranslate.y}px)` :
                        undefined,
                }}
            >
                <PulsatingDot/>
            </div>
            <TourTipBackdrop
                show={isMounted}
                onDismiss={handleDismiss}
                onPunchOut={handlePunchOut}
                interactivePunchOut={interactivePunchOut}
                overlayPunchOut={overlayPunchOut}
                appendTo={backdropPortal}
                transparent={hideBackdrop}
            />
            {isMounted && (
                <FloatingPortal id={ROOT_PORTAL_ID}>
                    <div
                        ref={setFloating}
                        className={classNames(
                            'tour-tip__positioner',
                            className,
                            {'tippy-blue-style': tippyBlueStyle},
                        )}
                        style={{
                            ...floatingStyles,
                            ...transitionStyles,
                            transform: combinedTransform || undefined,
                            maxWidth: width,
                            zIndex,
                        }}
                        data-placement={resolvedPlacement}
                        role='dialog'
                        aria-labelledby={titleId}
                    >
                        <TourPoint
                            data-testid='current_tutorial_tip'
                            title={<span id={titleId}>{title}</span>}
                            pointerPosition={pointerPosition}
                            showPulsingDot={false}
                            onClose={invokeMouseHandler(handleDismiss)}
                            closeLabel={formatMessage({id: 'tutorial_tip.close', defaultMessage: 'Close'})}
                            closeButtonProps={{'data-testid': 'close_tutorial_tip'}}
                            media={imageURL ? (
                                <img
                                    src={imageURL}
                                    alt='tutorial tour tip product image'
                                />
                            ) : undefined}
                            progress={showProgress ? {
                                pages: tourStepCount,
                                activePage: step + 1,
                                onPageChange: (page: number) => {
                                    handleJump?.({} as React.MouseEvent, page - 1);
                                },
                            } : undefined}
                            primaryAction={nextBtn ? {
                                label: nextBtn,
                                onClick: invokeMouseHandler(handleNext),
                            } : undefined}
                        >
                            {screen}
                        </TourPoint>
                        {showHostFooter && (
                            <div className='tour-tip__host-footer'>
                                {step !== 0 && prevBtn && (
                                    <Button
                                        id='tipPreviousButton'
                                        emphasis='tertiary'
                                        size='sm'
                                        onClick={handlePrevious}
                                    >
                                        {prevBtn}
                                    </Button>
                                )}
                                {showOptOut && (
                                    <div className='tour-tip__opt'>
                                        <FormattedMessage
                                            id='tutorial_tip.seen'
                                            defaultMessage='Seen this before? '
                                        />
                                        <Button
                                            emphasis='link'
                                            variant='inverted'
                                            size='xs'
                                            onClick={handleSkip}
                                        >
                                            <FormattedMessage
                                                id='tutorial_tip.out'
                                                defaultMessage='Opt out of these tips.'
                                            />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </FloatingPortal>
            )}
        </>
    );
};
