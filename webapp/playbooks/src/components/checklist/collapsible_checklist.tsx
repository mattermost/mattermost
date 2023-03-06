// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import styled from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';

import {FormattedMessage, useIntl} from 'react-intl';

import {clientRenameChecklist} from 'src/client';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';
import {CancelSaveButtons} from 'src/components/checklist_item/inputs';

import HoverMenu from './collapsible_checklist_hover_menu';

export interface Props {
    title: string;
    index: number;
    collapsed: boolean;
    setCollapsed: (newState: boolean) => void;
    items: ChecklistItem[];
    children: React.ReactNode;
    disabled: boolean;
    playbookRunID?: string;
    onRenameChecklist: (index: number, checklist: string) => void;
    onDuplicateChecklist: (index: number) => void;
    onDeleteChecklist: (index: number) => void;
    titleHelpText?: React.ReactNode;
    draggableProvided?: DraggableProvided;
}

const CollapsibleChecklist = ({
    title,
    index,
    collapsed,
    setCollapsed,
    items,
    children,
    disabled,
    playbookRunID,
    onRenameChecklist,
    onDuplicateChecklist,
    onDeleteChecklist,
    titleHelpText,
    draggableProvided,
}: Props) => {
    const titleRef = useRef(null);
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newChecklistTitle, setNewChecklistTitle] = useState(title);

    const icon = collapsed ? 'icon-chevron-right' : 'icon-chevron-down';
    const [completed, total] = tasksCompleted(items);
    const percentage = total === 0 ? 0 : (completed / total) * 100;

    let borderProps = {};
    if (draggableProvided) {
        borderProps = {
            ...draggableProvided.draggableProps,
            ref: draggableProvided.innerRef,
        };
    }

    const areAllTasksSkipped = items.every((item) => item.state === ChecklistItemState.Skip);
    const isChecklistSkipped = items.length > 0 && areAllTasksSkipped;

    let titleText = (
        <TextWithTooltipWhenEllipsis
            id={index.toString(10)}
            text={title}
            parentRef={titleRef}
        />
    );
    if (isChecklistSkipped) {
        titleText = (<StrikeThrough>{title}</StrikeThrough>);
    }

    let titleComp = (
        <Title ref={titleRef}>
            {titleText}
        </Title>
    );
    if (isRenaming) {
        titleComp = (
            <ChecklistInputComponent
                title={newChecklistTitle}
                setTitle={setNewChecklistTitle}
                onCancel={() => {
                    setIsRenaming(false);
                    setNewChecklistTitle(title);
                }}
                onSave={() => {
                    if (playbookRunID) {
                        clientRenameChecklist(playbookRunID, index, newChecklistTitle);
                    } else {
                        onRenameChecklist(index, newChecklistTitle);
                    }
                    setTimeout(() => setNewChecklistTitle(''), 300);
                    setIsRenaming(false);
                }}
            />
        );
    }

    const renderTitleHelpText = () => {
        if (isRenaming) {
            return null;
        }
        if (titleHelpText) {
            return titleHelpText;
        }
        return (
            <TitleHelpTextWrapper>
                <FormattedMessage
                    defaultMessage='{completed, number} / {total, number} done'
                    values={{completed, total}}
                />
            </TitleHelpTextWrapper>
        );
    };

    const renderHoverMenu = () => {
        if (isRenaming || disabled) {
            return null;
        }
        if (!showMenu) {
            return null;
        }
        return (
            <HoverMenu
                playbookRunID={playbookRunID}
                checklistIndex={index}
                checklistTitle={title}
                onRenameChecklist={() => setIsRenaming(true)}
                dragHandleProps={draggableProvided?.dragHandleProps}
                isChecklistSkipped={isChecklistSkipped}
                onDuplicateChecklist={() => onDuplicateChecklist(index)}
                onDeleteChecklist={() => onDeleteChecklist(index)}
            />
        );
    };

    return (
        <Border {...borderProps}>
            <HorizontalBG
                menuIsOpen={showMenu}
            >
                <Horizontal
                    data-testid={'checklistHeader'}
                    onClick={() => !isRenaming && setCollapsed(!collapsed)}
                    onMouseEnter={() => setShowMenu(true)}
                    onMouseLeave={() => setShowMenu(false)}
                >
                    <Icon className={icon}/>
                    {titleComp}
                    {renderTitleHelpText()}
                    {renderHoverMenu()}
                </Horizontal>
                <ProgressBackground>
                    <ProgressLine width={percentage}/>
                </ProgressBackground>
            </HorizontalBG>
            {!collapsed && children}
        </Border>
    );
};

const StrikeThrough = styled.text`
    text-decoration: line-through;
`;

const Border = styled.div`
    margin-bottom: 12px;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
`;

const ProgressBackground = styled.div`
    position: relative;

    &:after {
        border-bottom: 2px solid rgba(var(--center-channel-color-rgb), 0.08);
        content: '';
        display: block;
        width: 100%;
    }
`;

const ProgressLine = styled.div<{width: number}>`
    position: absolute;
    width: 100%;

    &:after {
        border-bottom: 2px solid var(--online-indicator);
        content: '';
        display: block;
        width: ${(props) => props.width}%;
    }
`;

export const HorizontalBG = styled.div<{menuIsOpen: boolean}>`
    background-color: var(--center-channel-bg);
    
    /* sets a higher z-index to the checklist with open menu */
    z-index: ${({menuIsOpen}) => (menuIsOpen ? '2' : '1')};

    position: sticky;
    top: 48px; // height of rhs_checklists MainTitle
`;

const Horizontal = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px 4px 0 0;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    display: flex;
    flex-direction: row;
    align-items: baseline;
    cursor: pointer;
`;

const Icon = styled.i`
    position: relative;
    top: 2px;
    margin: 0 0 0 6px;

    font-size: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    ${Horizontal}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
`;

const Title = styled.div`
    margin: 0 6px 0 0;

    font-weight: 600;
    font-size: 14px;
    line-height: 44px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    ${Horizontal}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.80);
    }
`;

export const TitleHelpTextWrapper = styled.div`
    margin-right: 16px;

    font-weight: 600;
    font-size: 12px;
    white-space: nowrap;
    color: rgba(var(--center-channel-color-rgb), 0.48);

    ${Horizontal}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const tasksCompleted = (items: ChecklistItem[]) => {
    let completed = 0;
    let total = 0;

    for (const item of items) {
        if (item.state !== ChecklistItemState.Skip) {
            total++;
        }
        if (item.state === ChecklistItemState.Closed) {
            completed++;
        }
    }

    return [completed, total];
};

export default CollapsibleChecklist;

interface ChecklistInputProps {
    onCancel: () => void;
    onSave: () => void;
    title: string;
    setTitle: (title: string) => void;
}

export const ChecklistInputComponent = (props: ChecklistInputProps) => {
    const {formatMessage} = useIntl();

    return (
        <>
            <ChecklistInput
                type={'text'}
                data-testid={'checklist-title-input'}
                onChange={(e) => props.setTitle(e.target.value)}
                value={props.title}
                autoFocus={true}
                onFocus={(e) => {
                    const val = e.target.value;
                    e.target.value = '';
                    e.target.value = val;
                }}
                placeholder={formatMessage({defaultMessage: 'Add checklist name'})}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        props.onSave();
                    } else if (e.key === 'Escape') {
                        props.onCancel();
                    }
                }}
            />
            <CancelSaveButtons
                onCancel={props.onCancel}
                onSave={props.onSave}
            />
        </>
    );
};

const ChecklistInput = styled.input`
    height: 32px;
    background: var(--center-channel-bg);
    border: 1px solid var(--center-channel-color-16);
    box-sizing: border-box;
    border-radius: 4px;
    width: 100%;
    padding: 0 10px;

    font-weight: 600;
    font-size: 14px;

    ::placeholder {
        font-weight: 400;
        font-style: italic;
    }
`;
