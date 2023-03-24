// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';

import {Coords} from 'src/components/tutorial/tutorial_tour_tip/backdrop';

import './dot.scss';

type Props = {
    targetRef?: React.RefObject<HTMLImageElement>;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    coords?: Coords;
}

export class PulsatingDot extends React.PureComponent<Props> {
    public render() {
        let customStyles = {};
        if (this.props?.coords) {
            customStyles = {
                transform: `translate(${this.props.coords?.x}px, ${this.props.coords?.y}px)`,
            };
        }
        let effectiveClassName = 'pb_pulsating_dot';
        if (this.props.onClick) {
            effectiveClassName += ' pb_pulsating_dot-clickable';
        }
        if (this.props.className) {
            effectiveClassName = effectiveClassName + ' ' + this.props.className;
        }

        return (
            <span
                className={effectiveClassName}
                onClick={this.props.onClick}
                ref={this.props.targetRef}
                style={{...customStyles}}
            />
        );
    }
}

export default PulsatingDot;
