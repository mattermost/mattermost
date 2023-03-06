import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {UserProfile} from '@mattermost/types/users';

import {
    DotMenuIcon,
    DropdownIcon,
    DropdownIconRed,
    StyledDotMenuButton,
    StyledDropdownMenu,
    StyledDropdownMenuItem,
    StyledDropdownMenuItemRed,
} from 'src/components/checklist/collapsible_checklist_hover_menu';
import DotMenu from 'src/components/dot_menu';
import {ChecklistHoverMenuButton} from 'src/components/rhs/rhs_shared';
import {ChecklistItemState} from 'src/types/playbook';
import {DateTimeOption} from 'src/components/datetime_selector';
import {Mode} from 'src/components/datetime_input';

import {clientDuplicateChecklistItem, clientRestoreChecklistItem, clientSkipChecklistItem} from 'src/client';

import AssignTo from './assign_to';
import {DueDateHoverMenuButton} from './duedate';

export interface Props {
    playbookRunId?: string;
    participantUserIds: string[];
    channelId?: string;
    checklistNum: number;
    itemNum: number;
    isSkipped: boolean;
    isEditing: boolean;
    onEdit: () => void;
    onChange?: (item: ChecklistItemState) => void;
    description: string;
    showDescription: boolean;
    toggleDescription: () => void;
    assignee_id: string;
    onAssigneeChange: (user?: UserProfile) => void;
    due_date: number;
    onDueDateChange: (value?: DateTimeOption | undefined | null) => void;
    onDuplicateChecklistItem?: () => void;
    onDeleteChecklistItem?: () => void;
    onItemOpenChange?: (isOpen: boolean) => void;
}

const ChecklistItemHoverMenu = (props: Props) => {
    const {formatMessage} = useIntl();
    if (props.isEditing) {
        return null;
    }
    return (
        <HoverMenu>
            {props.description !== '' &&
                <ToggleDescriptionButton
                    title={formatMessage({defaultMessage: 'Toggle description'})}
                    className={'icon icon-chevron-up'}
                    showDescription={props.showDescription}
                    onClick={props.toggleDescription}
                />
            }
            {!props.isSkipped &&
                <AssignTo
                    participantUserIds={props.participantUserIds}
                    assignee_id={props.assignee_id}
                    editable={props.isEditing}
                    inHoverMenu={true}
                    onSelectedChange={props.onAssigneeChange}
                    placement={'bottom-end'}
                    onOpenChange={props.onItemOpenChange}
                />
            }
            {!props.isSkipped &&
                <DueDateHoverMenuButton
                    date={props.due_date}
                    mode={props.playbookRunId ? Mode.DateTimeValue : Mode.DurationValue}
                    onSelectedChange={props.onDueDateChange}
                    placement={'bottom-end'}
                    onOpenChange={props.onItemOpenChange}
                    editable={props.isEditing}
                />
            }
            <ChecklistHoverMenuButton
                data-testid='hover-menu-edit-button'
                title={formatMessage({defaultMessage: 'Edit'})}
                className={'icon-pencil-outline icon-12 btn-icon'}
                onClick={() => {
                    props.onEdit();
                }}
            />
            <DotMenu
                icon={<DotMenuIcon/>}
                dotMenuButton={DotMenuButton}
                dropdownMenu={StyledDropdownMenu}
                placement='bottom-end'
                title={formatMessage({defaultMessage: 'More'})}
                onOpenChange={props.onItemOpenChange}
                focusManager={{returnFocus: false}}
            >
                <StyledDropdownMenuItem
                    onClick={() => {
                        if (props.playbookRunId) {
                            clientDuplicateChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum);
                        } else {
                            props.onDuplicateChecklistItem?.();
                        }
                    }}
                >
                    <DropdownIcon className='icon-content-copy icon-16'/>
                    {formatMessage({defaultMessage: 'Duplicate task'})}
                </StyledDropdownMenuItem>
                {props.playbookRunId !== undefined &&
                    <StyledDropdownMenuItem
                        onClick={() => {
                            if (props.isSkipped) {
                                clientRestoreChecklistItem(props.playbookRunId || '', props.checklistNum, props.itemNum);
                                if (props.onChange) {
                                    props.onChange(ChecklistItemState.Open);
                                }
                            } else {
                                clientSkipChecklistItem(props.playbookRunId || '', props.checklistNum, props.itemNum);
                                if (props.onChange) {
                                    props.onChange(ChecklistItemState.Skip);
                                }
                            }
                        }}
                    >
                        <DropdownIcon className={props.isSkipped ? 'icon-refresh icon-16 btn-icon' : 'icon-close icon-16 btn-icon'}/>
                        {props.isSkipped ? formatMessage({defaultMessage: 'Restore task'}) : formatMessage({defaultMessage: 'Skip task'})}
                    </StyledDropdownMenuItem>
                }
                {props.playbookRunId === undefined &&
                    <StyledDropdownMenuItemRed
                        onClick={() => props.onDeleteChecklistItem?.()}
                    >
                        <DropdownIconRed className={'icon-close icon-16'}/>
                        {formatMessage({defaultMessage: 'Delete task'})}
                    </StyledDropdownMenuItemRed>
                }
            </DotMenu>
        </HoverMenu>
    );
};

export const HoverMenu = styled.div`
    display: flex;
    align-items: center;
    padding: 0px 3px;
    position: absolute;
    height: 32px;
    right: 1px;
    top: -6px;
    border: 1px solid var(--center-channel-color-08);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    background: var(--center-channel-bg);
`;

const ToggleDescriptionButton = styled(ChecklistHoverMenuButton) <{showDescription: boolean}>`
    padding: 0;
    border-radius: 4px;
    &:before {
        transition: all 0.2s linear;
        transform: ${({showDescription}) => (showDescription ? 'rotate(0deg)' : 'rotate(180deg)')};
    }
`;

const DotMenuButton = styled(StyledDotMenuButton)`
    width: 24px;
    height: 24px;
`;

export default ChecklistItemHoverMenu;
