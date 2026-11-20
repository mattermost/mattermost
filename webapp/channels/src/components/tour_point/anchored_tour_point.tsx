// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    flip,
    FloatingPortal,
    offset,
    shift,
    useFloating,
} from '@floating-ui/react';
import React, {useLayoutEffect, useState} from 'react';

import {TourPoint} from '@mattermost/compass-ui/components/tour-point';
import type {TourPointPointerPosition} from '@mattermost/compass-ui/components/tour-point';

// The card floats over the channel. Every part of it ignores the pointer except
// its buttons, so a post, the emoji picker, or the composer under the card
// still receives the click.
const passThroughStyles = `
.anchored-tour-point,
.anchored-tour-point * {
    pointer-events: none;
}
.anchored-tour-point button,
.anchored-tour-point button * {
    pointer-events: auto;
}

/* .app__body h2 sets Metropolis and beats the title class. */
.app__body .anchored-tour-point h2 {
    font-family: var(--font-family-body);
}
`;

// The pointer hangs 9px past the card. Its tip is --spacing-xl (20px) in from
// the card edge the pointer sits on. The pulse is centered on that tip.
const POINTER_OUTSET = 9;
const POINTER_INSET = 20;
const TOUR_Z_INDEX = 1300;

type Aim = 'corner' | 'center';

type Props = {
    anchorId: string;
    aim: Aim;
    title: React.ReactNode;
    children: React.ReactNode;
    media?: React.ReactNode;
    closeLabel: string;
    onClose: () => void;
    primaryAction: {
        label: React.ReactNode;
        onClick: () => void;
    };
    testId: string;
    className?: string;
};

function pointerPosition(aim: Aim, above: boolean): TourPointPointerPosition {
    if (aim === 'corner') {
        return above ? 'bottom-left' : 'top-left';
    }
    return above ? 'bottom-center' : 'top-center';
}

const AnchoredTourPoint = ({
    anchorId,
    aim,
    title,
    children,
    media,
    closeLabel,
    onClose,
    primaryAction,
    testId,
    className,
}: Props) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    useLayoutEffect(() => {
        setAnchor(document.getElementById(anchorId));
    }, [anchorId]);

    const placement = aim === 'corner' ? 'top-start' : 'top';
    const {refs, floatingStyles, placement: resolved} = useFloating({
        elements: {reference: anchor},
        open: Boolean(anchor),
        whileElementsMounted: autoUpdate,
        placement,
        middleware: [
            offset(({rects, placement: current}) => ({
                mainAxis: POINTER_OUTSET,

                // A corner tip is inset from the card's start edge. Shift the
                // card so that tip lands on the anchor's end edge, and the
                // card opens across the composer instead of off the left side.
                crossAxis: aim === 'corner' && current.includes('start') ? rects.reference.width - POINTER_INSET : 0,
            })),
            flip({crossAxis: false, padding: 8}),
            shift({padding: 8}),
        ],
    });

    if (!anchor) {
        return null;
    }

    const above = resolved.startsWith('top');
    const position = pointerPosition(aim, above);

    return (
        <FloatingPortal id='root-portal'>
            <div
                ref={refs.setFloating}
                className='anchored-tour-point'
                style={{...floatingStyles, zIndex: TOUR_Z_INDEX}}
                data-testid={testId}
                data-anchor-id={anchorId}
                data-pointer-position={position}
            >
                <style>{passThroughStyles}</style>
                <TourPoint
                    className={className}
                    title={title}
                    pointerPosition={position}
                    media={media}
                    closeLabel={closeLabel}
                    onClose={onClose}
                    primaryAction={primaryAction}
                >
                    {children}
                </TourPoint>
            </div>
        </FloatingPortal>
    );
};

export default AnchoredTourPoint;
