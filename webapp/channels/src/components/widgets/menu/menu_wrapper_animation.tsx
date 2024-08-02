// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {CSSTransition} from 'react-transition-group';

import {isMobile} from './is_mobile_view_hack';

const ANIMATION_DURATION = 80;

type Props = {
    children?: React.ReactNode;
    show: boolean;
}

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
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

