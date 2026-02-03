// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoverOrigin} from '@mui/material/Popover';
import MuiPopover from '@mui/material/Popover';
import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import CompassDesignProvider from 'components/compass_design_provider';

import {A11yClassNames} from 'utils/constants';

import './actions_menu.scss';

export type PopoverProps = {
    anchorElement: Element | null | undefined;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle?: (isOpen: boolean) => void;

    anchorOrigin?: PopoverOrigin;
    transformOrigin?: PopoverOrigin;
}

const OPEN_ANIMATION_DURATION = 150;
const CLOSE_ANIMATION_DURATION = 100;

const defaultAnchorOrigin = {vertical: 'bottom', horizontal: 'left'} as PopoverOrigin;
const defaultTransformOrigin = {vertical: 'top', horizontal: 'left'} as PopoverOrigin;

export default function Popover({
    anchorElement,
    children,
    isOpen,
    onToggle,

    anchorOrigin = defaultAnchorOrigin,
    transformOrigin = defaultTransformOrigin,
}: PopoverProps) {
    const theme = useSelector(getTheme);

    const handleClose = useCallback(() => {
        onToggle?.(false);
    }, [onToggle]);

    return (
        <CompassDesignProvider theme={theme}>
            <MuiPopover
                anchorEl={anchorElement}
                open={isOpen}
                onClose={handleClose}
                className={classNames(A11yClassNames.POPUP, 'ActionsMenuEmptyPopover')}
                anchorOrigin={anchorOrigin}
                transformOrigin={transformOrigin}
                marginThreshold={0}
                TransitionProps={{
                    mountOnEnter: true,
                    unmountOnExit: true,
                    timeout: {
                        enter: OPEN_ANIMATION_DURATION,
                        exit: CLOSE_ANIMATION_DURATION,
                    },
                }}
                role='dialog'
                aria-modal={true}
                aria-labelledby={anchorElement?.id}
            >
                {children}
            </MuiPopover>
        </CompassDesignProvider>
    );
}
