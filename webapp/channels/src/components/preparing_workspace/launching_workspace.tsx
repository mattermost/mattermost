// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useDispatch} from 'react-redux';
import {CSSTransition} from 'react-transition-group';
import {FormattedMessage} from 'react-intl';

import {GeneralTypes} from 'mattermost-redux/action_types';

import LogoSvg from 'components/common/svg_images_components/logo_dark_blue_svg';

import loadingIcon from 'images/spinner-48x48-blue.apng';

import Title from './title';
import Description from './description';
import {Animations, mapAnimationReasonToClass, PreparingWorkspacePageProps} from './steps';

import './launching_workspace.scss';

type Props = PreparingWorkspacePageProps & {
    fullscreen?: boolean;
    zIndex?: number;
};

// Want to make sure background channels has rendered to limit animation jank,
// including things like tour tips auto-showing
export const START_TRANSITIONING_OUT = 500;
const TRANSITION_DURATION = 500;

// needs to be on top. Current known highest is tour tip at 1000
export const LAUNCHING_WORKSPACE_FULLSCREEN_Z_INDEX = 1001;

function LaunchingWorkspace(props: Props) {
    const [hasEntered, setHasEntered] = useState(false);
    const dispatch = useDispatch();
    useEffect(() => {
        // This component is showed in both the preparing workspace route as an outro (!fullscreen)
        // and in the main webapp as an intro (fullscreen)
        // We only want to track the page view once
        if (!props.fullscreen && props.show) {
            props.onPageView();
        }
    }, [props.show, props.fullscreen]);

    useEffect(() => {
        if (hasEntered) {
            return;
        }
        if (!props.fullscreen) {
            return;
        }
        setTimeout(() => {
            setHasEntered(true);

            // Needs to happen after animation time plays out
            setTimeout(() => {
                dispatch({type: GeneralTypes.SHOW_LAUNCHING_WORKSPACE, open: false});
            }, TRANSITION_DURATION);
        }, START_TRANSITIONING_OUT);
    }, [hasEntered, props.fullscreen]);

    let bodyClass = 'LaunchingWorkspace-body';
    if (!props.fullscreen) {
        bodyClass += ' LaunchingWorkspace-body--non-fullscreen';
    }
    const body = (
        <div className={bodyClass}>
            <div className='LaunchingWorkspace__spinner'>
                <img
                    src={loadingIcon}
                />
            </div>
            <Title>
                <FormattedMessage
                    id='onboarding_wizard.launching_workspace.title'
                    defaultMessage='Launching your workspace now'
                />
            </Title>
            <Description>
                <FormattedMessage
                    id='onboarding_wizard.launching_workspace.description'
                    defaultMessage='It’ll be ready in a moment'
                />
            </Description>
        </div>
    );

    let content = null;
    if (props.fullscreen) {
        content = (
            <CSSTransition
                in={props.show && !hasEntered}
                timeout={TRANSITION_DURATION}
                classNames={'LaunchingWorkspaceFullscreenWrapper'}
                exit={true}
                enter={false}
                mountOnEnter={true}
                unmountOnExit={true}
            >
                <div
                    className='LaunchingWorkspaceFullscreenWrapper-body'
                    style={{
                        zIndex: props.zIndex,
                    }}
                >
                    <div className='LaunchingWorkspaceFullscreenWrapper__logo'>
                        <LogoSvg/>
                    </div>
                    {body}
                </div>
            </CSSTransition>

        );
    } else {
        content = (
            <CSSTransition
                in={props.show}
                timeout={Animations.PAGE_SLIDE}
                classNames={mapAnimationReasonToClass('LaunchingWorkspace', props.transitionDirection)}
                mountOnEnter={true}
                unmountOnExit={true}
            >
                {body}
            </CSSTransition>
        );
    }
    return content;
}

export default LaunchingWorkspace;
