// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useRef} from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage, useIntl} from 'react-intl';
import Tippy from '@tippyjs/react';

import useTutorialTourTipManager from './manager';

import PulsatingDot from './dot';
import TutorialTourTipBackdrop, {TutorialTourTipPunchout} from './backdrop';
import './tutorial_tour_tip.scss';

const rootPortal = document.getElementById('root-portal');

type OverlayProps = {
    children: React.ReactNode;
    show: boolean;
    onClick: (e: React.MouseEvent) => void;
};
const TourTipOverlay = ({children, show, onClick}: OverlayProps) => {
    if (!show) {
        return null;
    }

    return ReactDOM.createPortal((
        <div
            className='pb-tutorial-tour-tip__overlay'
            onClick={onClick}
        >
            {children}
        </div>
    ), rootPortal!);
};

type Placement = ComponentProps<typeof Tippy>['placement'];

type Props = {
    screen: React.ReactNode;
    title: React.ReactNode;
    imageURL?: string;
    punchOut?: TutorialTourTipPunchout | null;
    step: number;
    singleTip?: boolean;
    showOptOut?: boolean;
    placement?: Placement
    telemetryTag?: string;
    stopPropagation?: boolean;
    preventDefault?: boolean;
    tutorialCategory: string;
    onNextNavigateTo?: () => void;
    onPrevNavigateTo?: () => void;
    onFinish?: () => void;
    autoTour?: boolean;
    pulsatingDotPlacement?: Omit<Placement, 'auto' | 'auto-end'>;
    pulsatingDotTranslate?: {x: number; y: number};
    width?: string | number;
}

const TutorialTourTip = ({
    title,
    screen,
    imageURL,
    punchOut,
    autoTour,
    tutorialCategory,
    singleTip,
    step,
    onNextNavigateTo,
    onPrevNavigateTo,
    onFinish,
    telemetryTag,
    placement,
    showOptOut,
    pulsatingDotTranslate,
    pulsatingDotPlacement,
    stopPropagation = true,
    preventDefault = true,
    width = 320,
}: Props) => {
    const {formatMessage} = useIntl();
    const triggerRef = useRef(null);
    const {
        show,
        tourSteps,
        setShow,
        handleOpen,
        handleHide,
        handleNext,
        handlePrevious,
        handleSkipTutorial,
        handleSavePreferences,
        getLastStep,
    } = useTutorialTourTipManager({
        step,
        autoTour,
        telemetryTag,
        tutorialCategory,
        onNextNavigateTo,
        onPrevNavigateTo,
        onFinish,
        stopPropagation,
        preventDefault,
    });

    const getButtonText = (): JSX.Element => {
        let buttonText = (
            <>
                <FormattedMessage defaultMessage={'Next'}/>
                <i className='icon icon-chevron-right'/>
            </>
        );
        if (singleTip) {
            buttonText = (
                <FormattedMessage defaultMessage={'Got it'}/>
            );
            return buttonText;
        }

        const lastStep = getLastStep();
        if (step === lastStep) {
            buttonText = (
                <FormattedMessage defaultMessage={'Done'}/>
            );
        }

        return buttonText;
    };

    const dots = [];

    if (!singleTip && tourSteps) {
        for (let i = 0; i < (Object.values(tourSteps).length - 1); i++) {
            let className = 'pb-tutorial-tour-tip__circle';
            let circularRing = 'pb-tutorial-tour-tip__circular-ring';

            if (i === step) {
                className += ' active';
                circularRing += ' pb-tutorial-tour-tip__circular-ring-active';
            }

            dots.push(
                <div
                    key={'dotactive' + i}
                    className={circularRing}
                >
                    <a
                        href='#'

                        className={className}
                        data-screen={i}
                        onClick={() => handleSavePreferences(i)}
                    />
                </div>,
            );
        }
    }

    const content = (
        <>
            <div className='pb-tutorial-tour-tip__header'>
                <h4 className='pb-tutorial-tour-tip__header__title'>
                    {title}
                </h4>
                <button
                    className='pb-tutorial-tour-tip__header__close'
                    onClick={handleSkipTutorial}
                >
                    <i className='icon icon-close'/>
                </button>
            </div>
            <div className='pb-tutorial-tour-tip__body'>
                {screen}
            </div>
            {imageURL && (
                <div className='pb-tutorial-tour-tip__image'>
                    <img
                        src={imageURL}
                        alt={formatMessage({defaultMessage: 'tutorial tour tip product image'})}
                    />
                </div>
            )}
            <div className='pb-tutorial-tour-tip__footer'>
                <div className='pb-tutorial-tour-tip__footer-buttons'>
                    <div className='pb-tutorial-tour-tip__circles-ctr'>{dots}</div>
                    <div className={'pb-tutorial-tour-tip__btn-ctr'}>
                        {step !== 0 && (
                            <button
                                id='tipPreviousButton'
                                className='pb-tutorial-tour-tip__btn pb-tutorial-tour-tip__cancel-btn'
                                onClick={handlePrevious}
                            >
                                <i className='icon icon-chevron-left'/>
                                <FormattedMessage defaultMessage='Previous'/>
                            </button>
                        )}
                        <button
                            id='tipNextButton'
                            className='pb-tutorial-tour-tip__btn pb-tutorial-tour-tip__confirm-btn'
                            onClick={handleNext}
                        >
                            {getButtonText()}
                        </button>
                    </div>
                </div>
                {showOptOut && (
                    <div className='pb-tutorial-tour-tip__opt'>
                        <FormattedMessage defaultMessage='Seen this before?'/>
                        <a
                            href='#'
                            onClick={handleSkipTutorial}
                        >
                            <FormattedMessage defaultMessage='Opt out of these tips.'/>
                        </a>
                    </div>
                )}
            </div>
        </>
    );

    return (
        <>
            <div
                ref={triggerRef}
                onClick={handleOpen}
                className='pb-tutorial-tour-tip__pulsating-dot-ctr'
                data-pulsating-dot-placement={pulsatingDotPlacement || 'right'}
                style={{
                    transform: `translate(${pulsatingDotTranslate?.x}px, ${pulsatingDotTranslate?.y}px)`,
                }}
            >
                <PulsatingDot/>
            </div>
            <TourTipOverlay
                show={show}
                onClick={handleHide}
            >
                <TutorialTourTipBackdrop
                    x={punchOut?.x}
                    y={punchOut?.y}
                    width={punchOut?.width}
                    height={punchOut?.height}
                />
            </TourTipOverlay>
            {show && (
                <Tippy
                    showOnCreate={show}
                    content={content}
                    animation='scale-subtle'
                    trigger='click'
                    duration={[250, 150]}
                    maxWidth={width}
                    aria={{content: 'labelledby'}}
                    zIndex={9999}
                    reference={triggerRef}
                    interactive={true}
                    appendTo={rootPortal!}
                    onHide={() => setShow(false)}
                    offset={[0, 2]}
                    className={'pb-tutorial-tour-tip__box'}
                    placement={placement || 'right-start'}
                />
            )}
        </>
    );
};

export default TutorialTourTip;
