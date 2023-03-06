// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React from 'react';

import Tooltip from 'src/components/widgets/tooltip';
import {CompassIcon} from 'src/types/compass';

declare module 'react-bootstrap/esm/OverlayTrigger' {
    interface OverlayTriggerProps {
        shouldUpdatePosition?: boolean;
    }
}

interface HeaderButtonProps {
    tooltipId: string;
    tooltipMessage: string
    Icon: CompassIcon;
    onClick: () => void;
    isActive?: boolean;
    clicked?: boolean;
    size?: number;
    iconSize?: number;
    'aria-label'?: string;
    'data-testid': string;
}

const HeaderButton = ({tooltipId, tooltipMessage, Icon, onClick, isActive, clicked, size, iconSize, 'aria-label': ariaLabel, 'data-testid': dataTestId}: HeaderButtonProps) => {
    return (
        <Tooltip
            id={tooltipId}
            placement={'bottom'}
            shouldUpdatePosition={true}
            content={tooltipMessage}
        >
            <StyledHeaderIcon
                data-testid={dataTestId}
                onClick={() => onClick()}
                clicked={clicked ?? false}
                isActive={isActive ?? false}
                size={size}
                aria-label={ariaLabel}
            >

                <Icon
                    size={iconSize ?? 18}
                    color={isActive ? 'var(--button-bg)' : 'rgb(var(--center-channel-color-rgb), 0.56)'}
                />
            </StyledHeaderIcon>
        </Tooltip>
    );
};

const Icon = styled.button`
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    line-height: 24px;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const StyledHeaderIcon = styled(Icon)<{isActive: boolean; size?: number, clicked: boolean}>`
    display: grid;
    place-items: center;
    font-size: 18px;
    border-radius: 4px;
    margin-left: 4px;
    width: ${(props) => (props.size ?? 28)}px;
    height: ${(props) => (props.size ?? 28)}px;

    ${({clicked}) => !clicked && css`
        &:hover {
            background: var(--center-channel-color-08);
            color: var(--center-channel-color-72);
        }
    `}

    ${({clicked}) => clicked && css`
        background: var(--button-bg-08);
        color: var(--button-bg);
    `}

    ${({isActive: active}) => active && css`
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);

        :hover {
            background: rgba(var(--button-bg-rgb), 0.16);
            color: var(--button-bg);
        }
    `}
`;

export default HeaderButton;
