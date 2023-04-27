// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import styled from 'styled-components';

export type Coords = {
    x?: string;
    y?: string;
}
export type TutorialTourTipPunchout = Coords & {
    width?: string;
    height?: string;
}

export function clipPathFromPunchout(punchout?: TutorialTourTipPunchout | null): string {
    if (!punchout) {
        return '';
    }
    const {x, y, width, height} = punchout;
    if (!x || !y || !width || !height) {
        return '';
    }

    const vertices = [];

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

    return `polygon(${vertices.join(', ')})`;
}

interface Props {
    inRoot?: boolean;
    onClick: (e: React.MouseEvent) => void;
    zIndex?: number;
    punchout?: TutorialTourTipPunchout | null;
}

export default function ClickShield(props: Props) {
    const clipPath = clipPathFromPunchout(props.punchout);
    const shield = (
        <Shield
            data-testid='work-templates-new-tip-shield'
            onClick={props.onClick}
            zIndex={props.zIndex}
            clipPath={clipPath}
        />
    );
    if (props.inRoot) {
        return ReactDOM.createPortal(shield, document.getElementById('root')!);
    }
    return shield;
}

interface ShieldProps {
    zIndex?: number;
    clipPath: string;
}

// from bootstrap css
const workTemplateModalIndex = 1050;

const Shield = styled.div<ShieldProps>`
  z-index: ${(props) => ((props.zIndex || props.zIndex === 0) ? props.zIndex : workTemplateModalIndex + 1)};
  position: fixed;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  ${(props) => (props.clipPath ? 'clip-path: ' + props.clipPath + ';' : '')}
`;
