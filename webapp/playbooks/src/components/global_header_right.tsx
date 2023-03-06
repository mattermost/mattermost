// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {CheckboxMultipleMarkedOutlineIcon} from '@mattermost/compass-icons/components';

import GiveFeedbackButton from 'src/components/give_feedback_button';
import {closeBackstageRHS, openBackstageRHS} from 'src/actions';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {OVERLAY_DELAY} from 'src/constants';
import {backstageRHS, selectHasOverdueTasks} from 'src/selectors';

const IconButtonWrapper = styled.div<{toggled: boolean}>`
    position: relative;
    display: flex;
    background: ${(props) => (props.toggled ? 'var(--sidebar-text)' : 'transparent')};
    border-radius: 5px;
    padding: 4px;
    cursor: pointer;
`;

const UnreadBadge = styled.div<{toggled: boolean}>`
    position: absolute;
    z-index: 1;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    background: var(--dnd-indicator);
    border-radius: 100%;
    box-shadow: 0 0 0 2px var(--global-header-background);

    ${({toggled}) => toggled && css`
        box-shadow: 0 0 0 2px var(--sidebar-text);
    `}
`;

const GlobalHeaderGiveFeedbackButton = styled(GiveFeedbackButton)`
    padding: 0 5px;
    font-size: 11px;
    height: 24px;
`;

const GlobalHeaderRight = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const isOpen = useSelector(backstageRHS.isOpen);
    const section = useSelector(backstageRHS.section);
    const hasOverdueTasks = useSelector(selectHasOverdueTasks);

    const isTasksOpen = isOpen && section === BackstageRHSSection.TaskInbox;

    const onClick = () => {
        if (isTasksOpen) {
            dispatch(closeBackstageRHS());
        } else {
            dispatch(openBackstageRHS(BackstageRHSSection.TaskInbox, BackstageRHSViewMode.Overlap));
        }
    };

    const tooltip = (
        <Tooltip id='tasks'>
            {formatMessage({defaultMessage: 'Tasks'})}
        </Tooltip>
    );

    return (
        <>
            <GlobalHeaderGiveFeedbackButton/>
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delay={OVERLAY_DELAY}
                placement='bottom'
                overlay={tooltip}
                aria-label={formatMessage({defaultMessage: 'Select to toggle a list of tasks.'})}

            >
                <IconButtonWrapper
                    data-testid='header-task-inbox-icon'
                    onClick={onClick}
                    toggled={isTasksOpen}
                >
                    {hasOverdueTasks ? <UnreadBadge toggled={isTasksOpen}/> : null}
                    <CheckboxMultipleMarkedOutlineIcon
                        size={18}
                        color={isTasksOpen ? 'var(--team-sidebar)' : 'rgba(255,255,255,0.56)'}
                    />
                </IconButtonWrapper>

            </OverlayTrigger>
        </>
    );
};

export default GlobalHeaderRight;
