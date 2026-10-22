// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';

import './card.scss';

export type CardChildProps = {
    expanded?: boolean;

    // Opt out of CardBody's measure-then-animate expand behavior below for a
    // card that's always expanded from mount and never toggles -- renders
    // `height: auto` immediately with no transition, so there's no
    // intermediate collapsed frame to blink from.
    disableExpandAnimation?: boolean;
};

export default function CardBody(props: CardChildProps & {children: React.ReactNode}) {
    const [height, setHeight] = useState(0);
    const [expanding, setExpanding] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const stopExpanding = () => setExpanding(false);

    const card = (node: HTMLDivElement) => {
        if (node && node.children) {
            setHeight(Array.from(node.children).map((child) => child.scrollHeight).reduce((a, b) => a + b, 0));
        }
    };

    useEffect(() => {
        if (props.disableExpandAnimation) {
            // Keep local state in sync with props while animation is
            // skipped, so it isn't stale if disableExpandAnimation later
            // flips back to false.
            setExpanding(false);
            setExpanded(Boolean(props.expanded));
            return;
        }

        setExpanding(true);
        if (props.expanded) {
            setExpanded(true);
        }
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
