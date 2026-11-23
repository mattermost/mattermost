// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    flip,
    FloatingPortal,
    shift,
    useFloating,
} from '@floating-ui/react';
import React, {useLayoutEffect, useState} from 'react';

import {TourPoint} from '@mattermost/compass-ui/components/tour-point';
import type {TourPointPointerPosition} from '@mattermost/compass-ui/components/tour-point';

// The card floats over the channel. Clicks pass through it except its buttons,
// including the closed pulsing-dot control. The wrapper is a 0×0 box so its
// origin is the TourPoint tip.
const passThroughStyles = `
.anchored-tour-point {
    width: 0;
    height: 0;
    line-height: 0;
}
.anchored-tour-point,
.anchored-tour-point * {
    pointer-events: none;
}
.anchored-tour-point button,
.anchored-tour-point button * {
    pointer-events: auto;
}
`;

// Below modals (1050), menus (1100), and popovers (1200). A tip on the
// composer must not take clicks from a dialog or an open menu.
const TOUR_Z_INDEX = 1000;

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

    // The TourPoint root is a 0×0 box whose origin is the pointer tip. Place
    // that origin on the control: the top-end corner of the +, or the top
    // center of the burn-on-read button. The closed dot is centered on the tip.
    const placement = aim === 'corner' ? 'top-end' : 'top';
    const {refs, floatingStyles, placement: resolved} = useFloating({
        elements: {reference: anchor},
        open: Boolean(anchor),
        whileElementsMounted: autoUpdate,
        placement,
        middleware: [
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
