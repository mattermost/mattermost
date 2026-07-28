// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useRef, useState} from 'react';

import './card.scss';

export type CardChildProps = {
    expanded?: boolean;

    // Opt out of CardBody's measure-then-animate expand behavior below for a
    // card that's always expanded from mount and never toggles -- renders
    // `height: auto` immediately with no transition, so there's no
    // intermediate collapsed frame to blink from.
    disableExpandAnimation?: boolean;
};

// Matches the CSS transition-duration below (0.3s) plus a buffer. This is not
// just a rare-timing backstop: every current production consumer of Card
// passes a `console`-family className, and `.console .Card__body.expanding {
// transition: none; }` (card.scss) disables the CSS transition outright for
// all of them -- meaning `transitionend` can never fire natively for any of
// today's real usages, and this timer is the ONLY mechanism that ever clears
// `expanding` for those cards. (For any future non-`.console` consumer where
// the transition does run normally, this still serves as the edge-case
// backstop it looks like: late-settling layout inside the card, or a web font
// swap, can finish sizing after the ref-measured `height` was captured and
// likewise prevent a genuine transitionable change from ever registering.)
// Do not remove this without confirming `.console` cards no longer disable
// the transition, or every one of them will silently regress to the
// permanently-clipped-content bug this was added to fix.
const EXPAND_TRANSITION_FALLBACK_MS = 350;

export default function CardBody(props: CardChildProps & {children: React.ReactNode}) {
    const [height, setHeight] = useState(0);
    const [expanding, setExpanding] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const fallbackTimeout = useRef<ReturnType<typeof setTimeout>>();

    const stopExpanding = () => {
        if (fallbackTimeout.current) {
            clearTimeout(fallbackTimeout.current);
            fallbackTimeout.current = undefined;
        }
        setExpanding(false);
    };

    const card = (node: HTMLDivElement) => {
        if (node && node.children) {
            setHeight(Array.from(node.children).map((child) => child.scrollHeight).reduce((a, b) => a + b, 0));
        }
    };

    useEffect(() => {
        if (props.disableExpandAnimation) {
            return undefined;
        }

        setExpanding(true);
        if (props.expanded) {
            setExpanded(true);
        }

        fallbackTimeout.current = setTimeout(stopExpanding, EXPAND_TRANSITION_FALLBACK_MS);

        return () => {
            if (fallbackTimeout.current) {
                clearTimeout(fallbackTimeout.current);
            }
        };
    }, [props.expanded, props.disableExpandAnimation]);

    useEffect(() => {
        if (!props.expanded) {
            setExpanded(false);
        }
    }, [expanding]);

    // Skips the measure-then-animate machinery above entirely: no ref-measured
    // height, no `expanding` transition class, no inline height style. Renders
    // `height: auto` immediately from the very first paint via plain CSS
    // (`.Card__body.expanded:not(.expanding)` already beats the base `height: 0`
    // rule on specificity alone) -- for a card that's always expanded from
    // mount and never toggles, this is both simpler and blink-free, since there
    // is no intermediate "collapsed" frame ever rendered to animate away from.
    if (props.disableExpandAnimation) {
        return (
            <div className={classNames('Card__body', {expanded: props.expanded})}>
                {props.children}
            </div>
        );
    }

    return (
        <div
            ref={card}
            style={{
                height: (expanding && expanded) ? height : '',
            }}
            className={classNames('Card__body', {expanded, expanding})}
            onTransitionEnd={stopExpanding}
        >
            {props.children}
        </div>
    );
}
