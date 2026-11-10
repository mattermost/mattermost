// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import {FloatingPortal, autoUpdate, offset, size, useFloating} from '@floating-ui/react';
import React from 'react';

import './row_drop_indicator.scss';

type Props = {
    rowElement: HTMLElement;
    edge: Edge;
};

export function RowDropIndicator({rowElement, edge}: Props) {
    const {refs, floatingStyles} = useFloating({
        elements: {reference: rowElement},
        whileElementsMounted: autoUpdate,
        placement: 'top-start',
        middleware: [
            offset(({rects}) => -rects.reference.height),
            size({
                apply({rects, elements}) {
                    elements.floating.style.width = `${rects.reference.width}px`;
                    elements.floating.style.height = `${rects.reference.height}px`;
                },
            }),
        ],
    });

    return (
        <FloatingPortal>
            <div
                ref={refs.setFloating}
                className='listTableRowDropIndicator'
                style={floatingStyles}
            >
                <DropIndicator edge={edge}/>
            </div>
        </FloatingPortal>
    );
}
