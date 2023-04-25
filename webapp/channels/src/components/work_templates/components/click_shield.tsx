// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

import styled from 'styled-components';

interface Props {
    inRoot?: boolean;
    onClick: () => void;
    zIndex?: number;
}

export default function ClickShield(props: Props) {
    const shield = (
        <Shield
            onClick={props.onClick}
            zIndex={props.zIndex}
        />
    );
    if (props.inRoot) {
        return ReactDOM.createPortal(shield, document.getElementById('root')!);
    }
    return shield;
}

interface ShieldProps {
    zIndex?: number;
}

// from bootstrap css
const workTemplateModalIndex = 1050;

const Shield = styled.div<ShieldProps>`
  z-index: ${(props) => ((props.zIndex !== undefined) ? props.zIndex : workTemplateModalIndex + 1)};
  position: fixed;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;
