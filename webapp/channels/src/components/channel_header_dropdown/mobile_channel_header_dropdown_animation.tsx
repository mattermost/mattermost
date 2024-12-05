// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {CSSTransition} from 'react-transition-group';

const ANIMATION_DURATION = 350;

type Props = {
    children?: ReactNode;
    show: boolean;
};

const timeout = {
    enter: ANIMATION_DURATION,
    exit: ANIMATION_DURATION,
};

const MobileChannelHeaderDropdownAnimation = ({show, children}: Props) => {
    return (
        <CSSTransition
            in={show}
            classNames='mobile-channel-header-dropdown'
            enter={true}
            exit={true}
            mountOnEnter={true}
            unmountOnExit={true}
            timeout={timeout}
        >
            {children}
        </CSSTransition>
    );
};

export default MobileChannelHeaderDropdownAnimation;
