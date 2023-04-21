// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Tippy from '@tippyjs/react';
import {Placement} from 'tippy.js';

import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';
import 'tippy.js/animations/scale-subtle.css';
import 'tippy.js/animations/perspective-subtle.css';
import '@mattermost/components/tour_tip.scss';

import classNames from 'classnames';
interface Props {
    placement?: Placement;
    children: React.ReactNode;
    tippyBlueStyle?: boolean;
    contentRef: any;
    offset?: [number, number];
    width?: string | number;
    zIndex?: number;
    className?: string;
    show: boolean;
    handleDismiss?: (e: React.MouseEvent) => void;
    hideBackdrop?: boolean;
}
import {TourTipBackdrop} from '@mattermost/components';

// onPunchOut={handlePunchOut}
// interactivePunchOut={interactivePunchOut}
export default function SingleTip(props: Props) {
    const rootPortal = document.getElementById('root-portal') || document.body;
    const content = (
        <div>
            {props.children}
        </div>
    );
    return (
        <>
            <TourTipBackdrop
                show={props.show}
                onDismiss={props.handleDismiss}
                overlayPunchOut={null}
                appendTo={rootPortal!}
                transparent={props.hideBackdrop}
            />
            <Tippy
                showOnCreate={props.show}
                content={content}
                animation='scale-subtle'
                trigger='click'
                duration={[250, 150]}
                maxWidth={props.width}
                aria={{content: 'labelledby'}}
                allowHTML={true}
                zIndex={props.zIndex}
                reference={props.contentRef}
                interactive={true}
                appendTo={rootPortal!}
                offset={props.offset}
                className={classNames(
                    'tour-tip__box',
                    props.className,
                    {'tippy-blue-style': props.tippyBlueStyle},
                )}
                placement={props.placement}
            />
        </>
    );
}
