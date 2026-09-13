// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useState} from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {DateTime} from 'luxon';
import {KeyVariantCircleIcon} from '@mattermost/compass-icons/components';

import {AdminNotificationType} from 'src/constants';
import UpgradeModal from 'src/components/backstage/upgrade_modal';
import {getTimestamp} from 'src/components/rhs/rhs_post_update';
import {AnchorLinkTitle} from 'src/components/backstage/playbook_runs/shared';
import {Timestamp} from 'src/webapp_globals';
import {openUpdateRunStatusModal} from 'src/actions';
import {PlaybookRun, PlaybookRunStatus, StatusPostComplete} from 'src/types/playbook_run';
import {useAllowRequestUpdate, useNow} from 'src/hooks';
import Clock from 'src/components/assets/icons/clock';
import {TertiaryButton, UpgradeTertiaryButton} from 'src/components/assets/buttons';
import {FUTURE_TIME_SPEC, PAST_TIME_SPEC} from 'src/components/time_spec';
import {requestUpdate} from 'src/client';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import DotMenu, {DropdownMenuItemStyled} from 'src/components/dot_menu';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import Tooltip from 'src/components/widgets/tooltip';

import {useToaster} from 'src/components/backstage/toast_banner';

import {ToastStyle} from 'src/components/backstage/toast';

import StatusUpdateCard from './update_card';
import {RHSContent} from './rhs';

enum dueType {
    Scheduled = 'scheduled',
    Overdue = 'overdue',
    Past = 'past',
    Finished = 'finished',
}

// getDueInfo does all the computation to know the relative date and text
// that should be done related to the last/next status update
const getDueInfo = (playbookRun: PlaybookRun, now: DateTime) => {
    const isFinished = playbookRun.current_status === PlaybookRunStatus.Finished;
    const isNextUpdateScheduled = playbookRun.previous_reminder !== 0;
    const timestamp = getTimestamp(playbookRun, isNextUpdateScheduled);
    const isDue = isNextUpdateScheduled && timestamp < now;

    let type: dueType;
    let text: React.ReactNode;

    if (isFinished) {
        text = <FormattedMessage defaultMessage='Run finished'/>;
        type = dueType.Finished;
    } else if (isNextUpdateScheduled) {
        type = (isDue ? dueType.Overdue : dueType.Scheduled);
        text = (isDue ? <FormattedMessage defaultMessage='Update overdue'/> : <FormattedMessage defaultMessage='Update due'/>);
    } else {
        type = dueType.Past;
        text = <FormattedMessage defaultMessage='Last update'/>;
    }

    const timespec = (isDue || !isNextUpdateScheduled) ? PAST_TIME_SPEC : FUTURE_TIME_SPEC;
    const time = (
        <Timestamp
            value={timestamp.toJSDate()}
            units={timespec}
            useTime={false}
        />
    );
    return {time, text, type};
};

const RHSTitle = <FormattedMessage defaultMessage={'Status updates'}/>;
const openRHSText = <FormattedMessage defaultMessage={'View all updates'}/>;
interface ViewerProps {
    id: string;
    playbookRun: PlaybookRun;
    lastStatusUpdate?: StatusPostComplete;
    openRHS: (section: RHSContent, title: React.ReactNode, subtitle?: React.ReactNode) => void;
}

const useRequestUpdate = (playbookRunId: string) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const [showRequestUpdateConfirm, setShowRequestUpdateConfirm] = useState(false);
    const requestStatusUpdate = async () => {
        const response = await requestUpdate(playbookRunId);
        if (response?.error) {
            addToast({
                content: formatMessage({defaultMessage: 'The update request was unsuccessful.'}),
                toastStyle: ToastStyle.Failure,
            });
        } else {
            addToast({
                content: formatMessage({defaultMessage: 'Your request was sent to the run channel. '}),
                toastStyle: ToastStyle.Success,
            });
        }
    };
    const RequestUpdateConfirmModal = (
        <ConfirmModal
            show={showRequestUpdateConfirm}
            title={formatMessage({defaultMessage: 'Request an update '})}
            message={formatMessage({defaultMessage: 'A status update request will be sent to the run channel. '})}
            confirmButtonText={formatMessage({defaultMessage: 'Send request '})}
            onConfirm={() => {
                requestStatusUpdate();
                setShowRequestUpdateConfirm(false);
            }}
            onCancel={() => setShowRequestUpdateConfirm(false)}
        />
    );
    return {
        RequestUpdateConfirmModal,
        showRequestUpdateConfirm: () => {
            setShowRequestUpdateConfirm(true);
        },
    };
};

export const ViewerStatusUpdate = ({id, playbookRun, openRHS, lastStatusUpdate}: ViewerProps) => {
    const {formatMessage} = useIntl();
    const fiveSeconds = 5000;
    const now = useNow(fiveSeconds);
    const {RequestUpdateConfirmModal, showRequestUpdateConfirm} = useRequestUpdate(playbookRun.id);
    const {RequestUpdateButton, UpgradeLicenseModal} = useRequestUpdateButton({
        onClick: showRequestUpdateConfirm,
        type: 'button',
        disabled: false,
    });

    if (!playbookRun.status_update_enabled) {
        return null;
    }

    if (playbookRun.status_posts.length === 0 && playbookRun.current_status === PlaybookRunStatus.Finished) {
        return null;
    }

    const dueInfo = getDueInfo(playbookRun, now);

    const renderStatusUpdate = () => {
        if (playbookRun.status_posts.length === 0 || !lastStatusUpdate) {
            return null;
        }
        return <StatusUpdateCard post={lastStatusUpdate}/>;
    };

    return (
        <Container
            id={id}
            data-testid={'run-statusupdate-section'}
        >
            <Header>
                <AnchorLinkTitle
                    title={formatMessage({defaultMessage: 'Recent status update'})}
                    id={id}
                />
                <RightWrapper>
                    <IconWrapper>
                        <IconClock
                            type={dueInfo.type}
                            size={14}
                        />
                    </IconWrapper>
                    <TextDateViewer
                        data-testid={'update-due-date-text'}
                        type={dueInfo.type}
                    >
                        {dueInfo.text}
                    </TextDateViewer>
                    <DueDateViewer
                        data-testid={'update-due-date-time'}
                        type={dueInfo.type}
                    >
                        {dueInfo.time}
                    </DueDateViewer>
                    {playbookRun.current_status === PlaybookRunStatus.InProgress ? RequestUpdateButton : null}
                </RightWrapper>
            </Header>
            <Content isShort={false}>
                {renderStatusUpdate() || <Placeholder>{formatMessage({defaultMessage: 'No updates have been posted yet'})}</Placeholder>}
            </Content>
            {playbookRun.status_posts.length ? <ViewAllUpdates onClick={() => openRHS(RHSContent.RunStatusUpdates, formatMessage({defaultMessage: 'Status updates'}), playbookRun.name)}>
                {openRHSText}
            </ViewAllUpdates> : null}
            {RequestUpdateConfirmModal}
            {UpgradeLicenseModal}
        </Container>
    );
};

interface ParticipantProps {
    id: string;
    playbookRun: PlaybookRun;
    openRHS: (section: RHSContent, title: React.ReactNode, subtitle?: React.ReactNode) => void;
}

export const ParticipantStatusUpdate = ({id, playbookRun, openRHS}: ParticipantProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {RequestUpdateConfirmModal, showRequestUpdateConfirm} = useRequestUpdate(playbookRun.id);
    const {RequestUpdateButton, UpgradeLicenseModal} = useRequestUpdateButton({
        onClick: playbookRun.current_status === PlaybookRunStatus.Finished ? undefined : showRequestUpdateConfirm,
        disabled: playbookRun.current_status === PlaybookRunStatus.Finished,
        type: 'dotmenu',
    });
    const fiveSeconds = 5000;
    const now = useNow(fiveSeconds);

    if (!playbookRun.status_update_enabled) {
        return null;
    }

    const dueInfo = getDueInfo(playbookRun, now);

    // We assume that user permissions have been checked before
    const postUpdate = () => dispatch(openUpdateRunStatusModal(playbookRun.id, playbookRun.channel_id, true));

    const onClickViewAllUpdates = () => {
        if (playbookRun.status_posts.length === 0) {
            return;
        }
        openRHS(RHSContent.RunStatusUpdates, RHSTitle, playbookRun.name);
    };

    return (
        <Container
            id={id}
            data-testid={'run-statusupdate-section'}
        >
            <Content isShort={true}>
                <IconWrapper>
                    <IconClock
                        type={dueInfo.type}
                        size={20}
                    />
                </IconWrapper>
                <TextDate
                    data-testid={'update-due-date-text'}
                    type={dueInfo.type}
                >{dueInfo.text}</TextDate>
                <DueDateParticipant
                    data-testid={'update-due-date-time'}
                    type={dueInfo.type}
                >{dueInfo.time}</DueDateParticipant>
                <RightWrapper>
                    {playbookRun.current_status === PlaybookRunStatus.InProgress ? (
                        <PostUpdateButton
                            data-testid={'post-update-button'}
                            onClick={postUpdate}
                        >
                            {formatMessage({defaultMessage: 'Post update'})}
                        </PostUpdateButton>
                    ) : null}
                    <Kebab>
                        <DotMenu
                            icon={<ThreeDotsIcon/>}
                            placement='bottom-end'
                        >
                            <DropdownItem
                                onClick={onClickViewAllUpdates}
                                disabled={playbookRun.status_posts.length === 0}
                            >
                                {openRHSText}
                            </DropdownItem>
                            {RequestUpdateButton}
                        </DotMenu>
                    </Kebab>
                </RightWrapper>
            </Content>
            {playbookRun.status_posts.length ? <ViewAllUpdates onClick={onClickViewAllUpdates}>
                {formatMessage({defaultMessage: 'View all updates'})}
            </ViewAllUpdates> : null}
            {RequestUpdateConfirmModal}
            {UpgradeLicenseModal}
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    margin: 8px 0 16px;
`;

const Content = styled.div<{isShort: boolean}>`
    display: flex;
    height: ${({isShort}) => (isShort ? '56px' : 'auto')};
    flex-direction: row;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

const Header = styled.div`
    display: flex;
    flex: 1;
    align-items: center;
    margin-top: 16px;
    margin-bottom: 4px;
`;

const Placeholder = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Kebab = styled.div`
    display: flex;
    margin-left: 8px;
`;

const ThreeDotsIcon = styled(HamburgerButton)`
    margin-left: 4px;
    font-size: 18px;
`;

const DropdownItem = styled(DropdownMenuItemStyled)<{disabled: boolean}>`
    cursor: ${({disabled}) => (disabled ? 'not-allowed' : 'pointer')};
    opacity: ${({disabled}) => (disabled ? '0.50' : '1')};
`;

const IconWrapper = styled.div`
    display: flex;
    margin-left: 4px;
`;

const TextDate = styled.div<{type: dueType}>`
    display: flex;
    margin: 0 4px;
    color: ${({type}) => (type === dueType.Overdue ? 'var(--dnd-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    font-size: 14px;
    line-height: 20px;
`;

const TextDateViewer = styled(TextDate)`
    font-size: 12px;
    line-height: 9.5px;
`;

const DueDateParticipant = styled.div<{type: dueType}>`
    display: flex;
    margin-right: 5px;
    color: ${({type}) => (type === dueType.Overdue ? 'var(--dnd-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    font-size: 14px;
    font-weight: 600;
    line-height:20px;
`;

const IconClock = styled(Clock)<{type: dueType, size: number}>`
    width: ${({size}) => size}px;
    height: ${({size}) => size}px;
    color: ${({type}) => (type === dueType.Overdue ? 'var(--dnd-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
`;

const DueDateViewer = styled(DueDateParticipant)`
    margin-right: 10px;
    font-size: 12px;
    line-height: 9.5px;

`;

const RightWrapper = styled.div`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
`;

const PostUpdateButton = styled(TertiaryButton)`
    height: 32px;
    padding: 0 48px;
    font-size: 12px;
`;

const useRequestUpdateButton = ({type, onClick, disabled = false}: {disabled: boolean, type: 'dotmenu' | 'button', onClick?: () => void}) => {
    const {formatMessage} = useIntl();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const requestUpdateAllowed = useAllowRequestUpdate();

    const commonProps = {
        'data-testid': 'request-update-button',
        children: formatMessage({defaultMessage: 'Request update...'}),
    };

    if (requestUpdateAllowed) {
        const RequestUpdateButton = type === 'dotmenu' ? (
            <DropdownItem
                disabled={disabled}
                onClick={onClick}
            >
                {formatMessage({defaultMessage: 'Request update...'})}
            </DropdownItem>
        ) : (
            <TertiaryButton
                style={{
                    position: 'relative',
                    fontSize: '12px',
                    height: '32px',
                    padding: '0 16px',
                }}
                onClick={onClick}
                {...commonProps}
            />
        );
        return {RequestUpdateButton};
    }

    const UpgradeLicenseModal = (
        <UpgradeModal
            messageType={AdminNotificationType.REQUEST_UPDATE}
            show={showUpgradeModal}
            onHide={() => setShowUpgradeModal(false)}
        />
    );

    const RequestUpdateButton = (
        <Tooltip
            id={'request-update-button-tooltip'}
            placement={'bottom'}
            content={formatMessage(
                {defaultMessage: '<title>Professional feature</title>\n<body>This is a paid feature, available with a free 30-day trial</body>'},
                {
                    title: (el) => <div>{el}</div>,
                    body: (el) => <span style={{opacity: 0.56}}>{el}</span>,
                }
            )}
        >
            {type === 'dotmenu' ? (
                <DotMenuItem
                    disabled={disabled}
                    onClick={() => setShowUpgradeModal(true)}
                >
                    {formatMessage({defaultMessage: 'Request update...'})}
                    <KeyVariantCircleIcon
                        color={'var(--online-indicator)'}
                        size={20}
                    />
                </DotMenuItem>
            ) : (
                <UpgradeTertiaryButton
                    style={{
                        position: 'relative',
                        fontSize: '12px',
                        height: '32px',
                        padding: '0 16px',
                    }}
                    onClick={() => setShowUpgradeModal(true)}
                    {...commonProps}
                />
            )}
        </Tooltip>
    );

    return {RequestUpdateButton, UpgradeLicenseModal};
};

const ViewAllUpdates = styled.div`
    width: fit-content;
    margin-top: 9px;
    color: var(--button-bg);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
`;

const DotMenuItem = styled(DropdownItem)`
    display: flex;

    svg {
        margin-left: 16px;
    }
`;
