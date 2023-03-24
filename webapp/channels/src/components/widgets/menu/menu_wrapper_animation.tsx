// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {CSSTransition} from 'react-transition-group';

import {isMobile} from 'utils/utils';

const ANIMATION_DURATION = 80;

type Props = {
    children?: React.ReactNode;
    show: boolean;
}

export default function MenuWrapperAnimation(props: Props) {
    if (isMobile()) {
        if (props.show) {
            return props.children;
        }

        return null;
    }

    return (
        <CSSTransition
            in={props.show}
            classNames='MenuWrapperAnimation'
            enter={true}
            exit={true}
            mountOnEnter={true}
            unmountOnExit={true}
            timeout={ANIMATION_DURATION}
        >
            {props.children}
        </CSSTransition>
    );
}

