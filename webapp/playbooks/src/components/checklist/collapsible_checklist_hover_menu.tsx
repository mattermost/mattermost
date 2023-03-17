// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {DraggableProvidedDragHandleProps} from 'react-beautiful-dnd';

import {clientDuplicateChecklist, clientRestoreChecklist, clientSkipChecklist} from 'src/client';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import DotMenu, {DotMenuButton, DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';

export interface Props {
    playbookRunID?: string;
    checklistIndex: number;
    checklistTitle: string;
    onRenameChecklist: () => void;
    onDuplicateChecklist: () => void;
    onDeleteChecklist: () => void;
    dragHandleProps: DraggableProvidedDragHandleProps | undefined;
    isChecklistSkipped: boolean;
}

const CollapsibleChecklistHoverMenu = (props: Props) => {
    const {formatMessage} = useIntl();

    let lastComponent = (
        <Handle
            title={formatMessage({defaultMessage: 'Restore checklist'})}
            className={'icon icon-refresh'}
            onClick={(e) => {
                e.stopPropagation();
                if (props.playbookRunID) {
                    clientRestoreChecklist(props.playbookRunID, props.checklistIndex);
                }
            }}
        />
    );
    if (!props.isChecklistSkipped || !props.playbookRunID) {
        lastComponent = (
            <DotMenu
                icon={<DotMenuIcon/>}
                dotMenuButton={StyledDotMenuButton}
                dropdownMenu={StyledDropdownMenu}
                placement='bottom-end'
                title={formatMessage({defaultMessage: 'More'})}
            >
                <StyledDropdownMenuItem onClick={props.onRenameChecklist}>
                    <DropdownIcon className='icon-pencil-outline icon-16'/>
                    {formatMessage({defaultMessage: 'Rename checklist'})}
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem
                    onClick={() => {
                        if (props.playbookRunID) {
                            clientDuplicateChecklist(props.playbookRunID, props.checklistIndex);
                        } else {
                            props.onDuplicateChecklist();
                        }
                    }}
                >
                    <DropdownIcon className='icon-content-copy icon-16'/>
                    {formatMessage({defaultMessage: 'Duplicate checklist'})}
                </StyledDropdownMenuItem>
                {props.playbookRunID !== undefined &&
                    <StyledDropdownMenuItemRed
                        onClick={() => clientSkipChecklist(props.playbookRunID || '', props.checklistIndex)}
                    >
                        <DropdownIconRed className={'icon-close icon-16'}/>
                        {formatMessage({defaultMessage: 'Skip checklist'})}
                    </StyledDropdownMenuItemRed>
                }
                {props.playbookRunID === undefined &&
                    <StyledDropdownMenuItemRed
                        onClick={() => props.onDeleteChecklist()}
                    >
                        <DropdownIconRed className={'icon-close icon-16'}/>
                        {formatMessage({defaultMessage: 'Delete checklist'})}
                    </StyledDropdownMenuItemRed>
                }
            </DotMenu>
        );
    }

    return (
        <ButtonRow>
            {props.dragHandleProps &&
                <Handle
                    title={formatMessage({defaultMessage: 'Drag to reorder checklist'})}
                    className={'icon icon-drag-vertical'}
                    {...props.dragHandleProps}
                />
            }
            {lastComponent}
        </ButtonRow>
    );
};

const Handle = styled(HoverMenuButton)`
    border-radius: 4px;
    margin-right: 8px;
    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08)
    }
`;

const ButtonRow = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    margin-left: auto;
    margin-right: 8px;
`;

export const DotMenuIcon = styled(HamburgerButton)`
    font-size: 14.4px;
`;

export const StyledDotMenuButton = styled(DotMenuButton)`
    align-items: center;
    justify-content: center;

    width: 28px;
    height: 28px;
`;

export const StyledDropdownMenu = styled(DropdownMenu)`
    padding: 8px 0;
`;

export const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    padding: 8px 0;
`;

export const StyledDropdownMenuItemRed = styled(DropdownMenuItem)`
    padding: 8px 0;
    && {
        color: #D24B4E;
    }
    &&:hover {
        color: #D24B4E;
    }
`;

export const DropdownIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-right: 11px;
`;

export const DropdownIconRed = styled.i`
    color: #D24B4E;
    margin-right: 11px;
`;

export default CollapsibleChecklistHoverMenu;
