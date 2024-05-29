// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect} from 'react';

import './card.scss';

export default function CardBody(props: {expanded?: boolean; children: React.ReactNode}) {
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
        setExpanding(true);
        if (props.expanded) {
            setExpanded(true);
        }
    }, [props.expanded]);

    useEffect(() => {
        if (!props.expanded) {
            setExpanded(false);
        }
    }, [expanding]);

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
