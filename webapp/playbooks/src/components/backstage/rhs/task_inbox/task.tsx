import React, {useState} from 'react';
import {NavLink} from 'react-router-dom';
import styled from 'styled-components';
import {CheckAllIcon, PlayOutlineIcon} from '@mattermost/compass-icons/components';

import Icon from '@mdi/react';
import {mdiCircleSmall} from '@mdi/js';

import {setChecklistItemState} from 'src/client';
import {ChecklistItemState} from 'src/types/playbook';
import {ChecklistItem as ItemComponent} from 'src/components/checklist_item/checklist_item';
import {HoverMenu} from 'src/components/checklist_item/hover_menu';
import {PlaybookRunChecklistItem} from 'src/types/playbook_run';

interface Props {
    item: PlaybookRunChecklistItem;
    enableAnimation: boolean;
}

const Task = (props: Props) => {
    const [removed, setRemoved] = useState(false);

    // Handles onchange with animation
    // if state changes from open to closed, set removed state and waits for 1 sec
    const onChangeState = (newState: ChecklistItemState) => {
        let prom;
        if (props.enableAnimation && props.item.state === ChecklistItemState.Open && newState === ChecklistItemState.Closed) {
            setRemoved(true);
            setTimeout(() => {
                prom = setChecklistItemState(props.item.playbook_run_id, props.item.checklist_num, props.item.item_num, newState);
            }, 500);
        } else {
            prom = setChecklistItemState(props.item.playbook_run_id, props.item.checklist_num, props.item.item_num, newState);
        }
        return prom;
    };

    return (
        <Container className={removed ? 'removed' : ''}>
            <Header>
                <PlayOutlineIcon
                    color={'rgba(63, 67, 80, 0.56)'}
                    size={18}
                />
                <HeaderText>
                    <NavLink to={`/playbooks/runs/${props.item.playbook_run_id}`}>{props.item.playbook_run_name}</NavLink>
                </HeaderText>
                <Icon
                    color={'rgba(63, 67, 80, 0.56)'}
                    path={mdiCircleSmall}
                    size={1}
                />
                <CheckAllIcon
                    color={'rgba(63, 67, 80, 0.56)'}
                    size={18}
                />
                <HeaderText>{props.item.checklist_title}</HeaderText>
            </Header>
            <Body>
                <ItemComponent
                    playbookRunId={props.item.playbook_run_id}
                    participantUserIds={props.item.playbook_run_participant_user_ids}
                    checklistItem={props.item}
                    checklistNum={props.item.checklist_num}
                    dragging={false}
                    collapsibleDescription={true}
                    descriptionCollapsedByDefault={true}
                    newItem={false}
                    readOnly={false}
                    itemNum={props.item.item_num}
                    onChange={onChangeState}
                />
            </Body>
        </Container>
    );
};

export default Task;

const Container = styled.div`
    padding: 16px 5px 12px 0;
    display: flex;
    flex-direction: column;

    &.removed {
        -webkit-animation: disapear 0.7s;
        -webkit-animation-fill-mode: forwards;
        animation: disapear 0.7s;
        animation-fill-mode: forwards;
    }

    @-webkit-keyframes disapear{
        50% {
            -webkit-transform: translateX(-5%);
            transform: translateX(-5%);
        }
        100% {
            -webkit-transform: translateX(200%);
            transform: translateX(200%);
        }
    }

    @keyframes disapear{
        50% {
            -webkit-transform: translateX(-5%);
            transform: translateX(-5%);
        }
        100% {
            -webkit-transform: translateX(200%);
            transform: translateX(200%);
        }
    }

    &:not(:first-child) {
        border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    }

    &:last-child {
        padding-bottom: 10px;
    }

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04)
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0 10px;
`;

const HeaderText = styled.div`
    font-size: 12px;
    line-height: 16px;
    max-width: 50%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-weight: 400;
    margin: 0 4px;
    padding: 4px 0;
    a {
        font-weight: 600;
    }
`;

// Necessary hack to use Checklist without DraggableProvider and use HoverMenu
const Body = styled.div`
    left: -10px;

    &:hover,
    &:focus-within {
        ${HoverMenu} {
            opacity: 1;
        }
    }
`;

