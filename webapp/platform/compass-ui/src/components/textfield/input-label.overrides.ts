// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Theme} from '@mui/material';
import type {ComponentsOverrides} from '@mui/material/styles/overrides';

import {iconSizeMap} from './textfield';

const componentName = 'MuiInputLabel';

declare module '@mui/material/InputLabel' {
    interface InputLabelProps {
        $withStartIcon?: boolean;
        $inputSize: 'small' | 'large' | 'medium';
    }
}

const styleOverrides: ComponentsOverrides<Theme>[typeof componentName] = {
    root: ({ownerState, theme}) => {
        if (ownerState.shrink) {
            return {
                transform: 'translate(15px, -8px) scale(0.75)',
            };
        }

        const iconSize = iconSizeMap[ownerState.$inputSize];
        let shiftX;
        let shiftY;

        switch (ownerState.$inputSize) {
        case 'small':
            shiftY = 12;
            shiftX = 12 + (ownerState.$withStartIcon ? (iconSize + 8) : 0);
            break;
        case 'large':
            shiftY = 16;
            shiftX = 16 + (ownerState.$withStartIcon ? (iconSize + 8) : 0);
            break;
        case 'medium':
        default:
            shiftY = 19;
            shiftX = 14 + (ownerState.$withStartIcon ? (iconSize + 8) : 0);
        }

        return {
            transform: `translate(${shiftX}px, ${shiftY}px)`,

            ...(ownerState.$inputSize === 'small' && theme.typography.b75),
            ...(ownerState.$inputSize === 'medium' && theme.typography.b100),
            ...(ownerState.$inputSize === 'large' && theme.typography.b200),

            margin: 0,
        };
    },
};

const overrides = {
    styleOverrides,
};

export default overrides;
