// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react'
import Tippy from '@tippyjs/react'
import ReactDOM from 'react-dom'
import {FormattedMessage} from 'react-intl'

import './tutorial_tour_tip.scss'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/themes/light-border.css'
import 'tippy.js/animations/scale-subtle.css'
import 'tippy.js/animations/perspective-subtle.css'

import {Placement} from 'tippy.js'

import CloseIcon from 'src/widgets/icons/close'
import Button from 'src/widgets/buttons/button'
import IconButton from 'src/widgets/buttons/iconButton'
import CompassIcon from 'src/widgets/icons/compassIcon'

import PulsatingDot from 'src/components/pulsating_dot'

import TutorialTourTipBackdrop, {Coords, TutorialTourTipPunchout} from './tutorial_tour_tip_backdrop'

import useTutorialTourTipManager, {TutorialTourTipManagerProps} from './tutorial_tour_tip_manager'

const TourTipOverlay = ({
    children,
    show,
    onClick,
}: { children: React.ReactNode, show: boolean, onClick: (e: React.MouseEvent) => void }) =>
    (show ? ReactDOM.createPortal(
        <div
            className='tutorial-tour-tip__overlay'
            onClick={onClick}
        >
            {children}
        </div>,
        document.body,
    ) : null)

type Props = {
    screen: JSX.Element
    title: JSX.Element
    imageURL?: string
    punchOut?: TutorialTourTipPunchout | null
    step: number
    singleTip?: boolean
    showOptOut?: boolean
    placement?: Placement
    telemetryTag?: string
    stopPropagation?: boolean
    preventDefault?: boolean
    tutorialCategory: string
    onNextNavigateTo?: () => void
    onPrevNavigateTo?: () => void
    autoTour?: boolean
    pulsatingDotPosition?: Coords | undefined
    width?: string | number
    className?: string
    hideNavButtons?: boolean
    hideBackdrop?: boolean
    clickThroughPunchhole?: boolean
    onPunchholeClick?: (e: React.MouseEvent) => void
    skipCategoryFromBackdrop?: boolean
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
    telemetryTag,
    placement,
    showOptOut,
    pulsatingDotPosition,
    stopPropagation = true,
    preventDefault = true,
    width = window.innerWidth > 2559 ? 500 : 320,
    className,
    hideNavButtons = false,
    hideBackdrop = false,
    onPunchholeClick,
    skipCategoryFromBackdrop,
}: Props): JSX.Element => {
    const managerProps: TutorialTourTipManagerProps = {
        step,
        autoTour,
        telemetryTag,
        tutorialCategory,
        onNextNavigateTo,
        onPrevNavigateTo,
        stopPropagation,
        preventDefault,
    }

    const triggerRef = useRef(null)
    const {
        show,
        tourSteps,
        handleOpen,
        handleHide,
        handleDismiss,
        handleNext,
        handlePrevious,
        handleSkipTutorial,
        handleSavePreferences,
        getLastStep,
        handleEventPropagationAndDefault,
        handleSendToNextTour,
    } = useTutorialTourTipManager(managerProps)

    const getButtonText = (): JSX.Element => {
        let buttonText = (
            <FormattedMessage
                id={'tutorial_tip.ok'}
                defaultMessage={'Next'}
            />
        )
        if (singleTip) {
            buttonText = (
                <FormattedMessage
                    id={'tutorial_tip.got_it'}
                    defaultMessage={'Got it'}
                />
            )

            return buttonText
        }

        const lastStep = getLastStep()
        if (step === lastStep) {
            buttonText = (
                <FormattedMessage
                    id={'tutorial_tip.finish_tour'}
                    defaultMessage={'Done'}
                />
            )
        }

        return buttonText
    }

    const dots = []

    if (!singleTip && tourSteps) {
        for (let i = 0; i < (Object.values(tourSteps).length); i++) {
            let classname = 'tutorial-tour-tip__circle'
            let circularRing = 'tutorial-tour-tip__circular-ring'

            if (i === step) {
                classname += ' active'
                circularRing += ' tutorial-tour-tip__circular-ring-active'
            }

            dots.push(
                <div
                    key={'dotactive' + i}
                    className={circularRing}
                >
                    <a
                        href='#'
                        className={classname}
                        data-screen={i}
                        onClick={() => handleSavePreferences(i)}
                    />
                </div>,
            )
        }
    }

    const content = (
        <div
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            <div className='tutorial-tour-tip__header'>
                <h4 className='tutorial-tour-tip__header__title'>
                    {title}
                </h4>
                <IconButton
                    className='tutorial-tour-tip__header__close'
                    size='small'
                    icon={<CloseIcon/>}
                    onClick={(e) => {
                        if (skipCategoryFromBackdrop) {
                            handleDismiss(e)
                            handleSendToNextTour(tutorialCategory)
                        }
                    }}
                />
            </div>
            <div className='tutorial-tour-tip__body'>
                {screen}
            </div>
            {imageURL && (
                <div className='tutorial-tour-tip__image'>
                    <img
                        src={imageURL}
                        alt={'tutorial tour tip product image'}
                    />
                </div>
            )}
            <div className='tutorial-tour-tip__footer'>
                <div className='tutorial-tour-tip__footer-buttons'>
                    <div className='tutorial-tour-tip__circles-ctr'>{dots}</div>
                    <div className={'tutorial-tour-tip__btn-ctr'}>
                        {!hideNavButtons && step !== 0 && (
                            <Button
                                title='Previous'
                                size='small'
                                emphasis='tertiary'
                                onClick={handlePrevious}
                                icon={
                                    <CompassIcon
                                        className='icon'
                                        icon='chevron-left'
                                    />}
                            >
                                <FormattedMessage
                                    id='generic.previous'
                                    defaultMessage='Previous'
                                />
                            </Button>
                        )}

                        {
                            !hideNavButtons && (
                                <Button
                                    className='tipNextButton'
                                    size='small'
                                    filled={true}
                                    onClick={handleNext}
                                    rightIcon={true}
                                    icon={(singleTip || step === getLastStep()) ? '' : (
                                        <CompassIcon
                                            className='icon'
                                            icon='chevron-right'
                                        />
                                    )
                                    }
                                >
                                    {getButtonText()}
                                </Button>
                            )
                        }
                    </div>
                </div>
                {showOptOut && <div className='tutorial-tour-tip__opt'>
                    <FormattedMessage
                        id='tutorial_tip.seen'
                        defaultMessage='Seen this before? '
                    />
                    <a
                        href='#'
                        onClick={handleSkipTutorial}
                    >
                        <FormattedMessage
                            id='tutorial_tip.out'
                            defaultMessage='Opt out of these tips.'
                        />
                    </a>
                </div>}
            </div>
        </div>
    )

    return (
        <>
            <div
                ref={triggerRef}
                onClick={handleOpen}
                className={`tutorial-tour-tip__pulsating-dot-ctr ${className || ''}`}
            >
                <PulsatingDot coords={pulsatingDotPosition}/>
            </div>
            <TourTipOverlay
                show={!hideBackdrop && show}
                onClick={(e) => {
                    handleEventPropagationAndDefault(e)
                    handleHide(e)
                    if (onPunchholeClick) {
                        onPunchholeClick(e)
                    }
                }}
            >
                <TutorialTourTipBackdrop
                    x={punchOut?.x}
                    y={punchOut?.y}
                    width={punchOut?.width}
                    height={punchOut?.height}
                    handleClick={(e) => {
                        if (skipCategoryFromBackdrop) {
                            e.preventDefault()
                            e.stopPropagation()
                            handleSendToNextTour(tutorialCategory)
                        }
                    }}
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
                    allowHTML={true}
                    zIndex={9999}
                    reference={triggerRef}
                    interactive={true}
                    appendTo={document.body}
                    className={`tutorial-tour-tip__box ${className || ''}`}
                    placement={placement}
                />
            )}
        </>
    )
}

export default TutorialTourTip
