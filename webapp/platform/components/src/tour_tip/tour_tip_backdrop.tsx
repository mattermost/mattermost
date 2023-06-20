// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import type {Props as PunchOutCoordsHeightAndWidth} from '../common/hooks/useMeasurePunchouts';

type Props = {
    overlayPunchOut: PunchOutCoordsHeightAndWidth | null;
    show: boolean;
    interactivePunchOut?: boolean;
    onDismiss?: (e: React.MouseEvent) => void;
    onPunchOut?: (e: React.MouseEvent) => void;
    appendTo: HTMLElement;
    transparent?: boolean;
}

const TourTipRootPortal = ({children, show, element}: {children: React.ReactNode ; show: boolean; element: Element}) =>
    (show ? ReactDOM.createPortal(
        children,
        element,
    ) : null);

export const TourTipBackdrop = ({
    show,
    overlayPunchOut,
    interactivePunchOut,
    onDismiss,
    onPunchOut,
    appendTo,
    transparent,
}: Props) => {
    const vertices = [];
    if (overlayPunchOut) {
        const {x, y, width, height} = overlayPunchOut;

        // draw to top left of punch out
        vertices.push('0% 0%');
        vertices.push('0% 100%');
        vertices.push('100% 100%');
        vertices.push('100% 0%');
        vertices.push(`${x} 0%`);
        vertices.push(`${x} ${y}`);

        // draw punch out
        vertices.push(`calc(${x} + ${width}) ${y}`);
        vertices.push(`calc(${x} + ${width}) calc(${y} + ${height})`);
        vertices.push(`${x} calc(${y} + ${height})`);
        vertices.push(`${x} ${y}`);

        // close off punch out
        vertices.push(`${x} 0%`);
        vertices.push('0% 0%');
    }
    const backdrop = (
        <div
            onClick={onDismiss}
            className={`tour-tip__backdrop ${transparent ? 'tour-tip__backdrop--transparent' : ''}`}
            style={{
                clipPath: vertices.length ? `polygon(${vertices.join(', ')})` : undefined,
            }}
        />
    );
    const overlay = interactivePunchOut ? backdrop : (
        <>
            <div
                className={'tour-tip__overlay'}
                onClick={onPunchOut || onDismiss}
            />
            {backdrop}
        </>
    );

    return (
        <TourTipRootPortal
            show={show}
            element={appendTo}
        >
            {overlay}
        </TourTipRootPortal>
    );
};
