// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import {DotMenuButton, DropdownMenuItem} from 'src/components/dot_menu';

export const DotMenuButtonStyled = styled(DotMenuButton)`
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
`;

export const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-items: center;

    svg {
        margin-right: 11px;
        fill: rgb(var(--center-channel-color-rgb), 0.56);
    }
`;

export const StyledDropdownMenuItemRed = styled(StyledDropdownMenuItem)`
    && {
        color: var(--dnd-indicator);

        svg {
            fill: var(--dnd-indicator);
        }

        :hover {
            background: var(--dnd-indicator);
            color: var(--button-color);

            svg {
                fill: var(--button-color);
            }
        }
    }
`;
