// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {CSSTransition} from 'react-transition-group';

import {isMobile} from './is_mobile_view_hack';

const ANIMATION_DURATION = 80;

type Props = {
    children?: React.ReactNode;
    show: boolean;
};

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
export default function MenuWrapperAnimation(props: Props) {
    // The children are arbitrary, so there's no element of our own to hang a ref on. Without a
    // nodeRef, CSSTransition falls back to findDOMNode, which React 18 warns about in StrictMode and
    // React 19 removes. The wrapper is a static box, so the menu inside it still positions itself
    // against .MenuWrapper.
    const nodeRef = useRef<HTMLDivElement>(null);

    if (isMobile()) {
        if (props.show) {
            return props.children;
        }

        return null;
    }

    return (
        <CSSTransition
            in={props.show}
            nodeRef={nodeRef}
            classNames='MenuWrapperAnimation'
            enter={true}
            exit={true}
            mountOnEnter={true}
            unmountOnExit={true}
            timeout={ANIMATION_DURATION}
        >
            <div ref={nodeRef}>
                {props.children}
            </div>
        </CSSTransition>
    );
}

