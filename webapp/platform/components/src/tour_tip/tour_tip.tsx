// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useFloating,
    autoUpdate,
    offset as floatingOffset,
    flip,
    shift,
    arrow,
    FloatingPortal,
    useTransitionStyles,
    type Placement,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useId, useRef, type CSSProperties, type JSX} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import {TourTipBackdrop} from './tour_tip_backdrop';

import type {Props as PunchOutCoordsHeightAndWidth} from '../common/hooks/useMeasurePunchouts';
import {PulsatingDot} from '../pulsating_dot';

import './tour_tip.scss';

export type TourTipEventSource = 'next' | 'prev' | 'dismiss' | 'jump' | 'skipped' | 'open' | 'punchOut';

// If this needs to alter, change in _variables $z-index-tour-tips-popover as well
const DEFAULT_Z_INDEX_TOUR_TIPS_POPOVER = 1300;
const ARROW_OFFSET = 12;
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

const staticSideByPlacement = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
} as const;

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
    const FIRST_STEP_INDEX = 0;
    const titleId = useId();
    const arrowRef = useRef<HTMLDivElement>(null);
    const onJump = (event: React.MouseEvent, jumpToStep: number) => {
        handleJump?.(event, jumpToStep);
    };

    const rootPortal = document.getElementById(ROOT_PORTAL_ID);
    const backdropPortal = rootPortal ?? document.body;

    const {
        refs: {setReference, setFloating},
        floatingStyles,
        context: floatingContext,
        placement: resolvedPlacement,
        middlewareData,
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
            arrow({
                element: arrowRef,
            }),
        ],
    });
    const {isMounted, styles: transitionStyles} = useTransitionStyles(
        floatingContext,
        TRANSITION_STYLE_PROPS,
    );

    const arrowStyles: CSSProperties = {};
    if (middlewareData.arrow?.x != null) {
        arrowStyles.left = `${middlewareData.arrow.x}px`;
    }
    if (middlewareData.arrow?.y != null) {
        arrowStyles.top = `${middlewareData.arrow.y}px`;
    }

    const mainPlacement = resolvedPlacement.split('-')[0] as keyof typeof staticSideByPlacement;
    const staticSide = staticSideByPlacement[mainPlacement];
    if (staticSide) {
        (arrowStyles as Record<string, string>)[staticSide] = `-${ARROW_OFFSET / 2}px`;
    }
    const combinedTransform = [
        floatingStyles.transform,
        transitionStyles.transform,
    ].filter(Boolean).join(' ');

    const dots = [];
    if (!singleTip && tourSteps) {
        for (let dot = FIRST_STEP_INDEX; dot < (Object.values(tourSteps).length - 1); dot++) {
            let className = 'tour-tip__dot';
            let circularRing = 'tour-tip__dot-ring';

            if (dot === step) {
                className += ' active';
                circularRing += ' tour-tip__dot-ring-active';
            }
            dots.push(
                <div className={circularRing}>
                    <a
                        href='#'
                        key={'dotactive' + dot}
                        className={className}
                        data-screen={dot}
                        onClick={(e) => onJump(e, dot)}
                    />
                </div>,
            );
        }
    }

    const content = (
        <>
            <div
                className='tour-tip__header'
                data-testid={'current_tutorial_tip'}
            >
                <h4
                    id={titleId}
                    className='tour-tip__header__title'
                >
                    {title}
                </h4>
                <button
                    className='btn btn-sm btn-icon'
                    onClick={handleDismiss}
                    data-testid={'close_tutorial_tip'}
                >
                    <i className='icon icon-close'/>
                </button>
            </div>
            <div className='tour-tip__body'>
                {screen}
            </div>
            {imageURL && (
                <div className='tour-tip__image'>
                    <img
                        src={imageURL}
                        alt={'tutorial tour tip product image'}
                    />
                </div>
            )}
            {(nextBtn || prevBtn || showOptOut) && (<div className='tour-tip__footer'>
                <div className='tour-tip__footer-buttons'>
                    <div className='tour-tip__dot-ctr'>{dots}</div>
                    <div className={'tour-tip__btn-ctr'}>
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
                        {nextBtn && (
                            <Button
                                id='tipNextButton'
                                emphasis='primary'
                                size='sm'
                                onClick={handleNext}
                            >
                                {nextBtn}
                            </Button>
                        )}
                    </div>
                </div>
                {showOptOut && (
                    <div className='tour-tip__opt'>
                        <FormattedMessage
                            id='tutorial_tip.seen'
                            defaultMessage='Seen this before? '
                        />
                        <a
                            href='#'
                            onClick={handleSkip}
                        >
                            <FormattedMessage
                                id='tutorial_tip.out'
                                defaultMessage='Opt out of these tips.'
                            />
                        </a>
                    </div>
                )}
            </div>
            )}
        </>
    );

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
                            'tour-tip__box',
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
                        {content}
                        <div
                            ref={arrowRef}
                            className='tour-tip__arrow'
                            style={arrowStyles}
                        />
                    </div>
                </FloatingPortal>
            )}
        </>
    );
};
