// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useState} from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {Team} from '@mattermost/types/teams';
import {useIntl} from 'react-intl';

import {DateTime} from 'luxon';

import {ClockOutlineIcon} from '@mattermost/compass-icons/components';

import {
    ParticipantsChangedDetails,
    TaskStateModifiedDetails,
    TimelineEvent,
    TimelineEventType,
    UserJoinedLeftDetails,
} from 'src/types/rhs';
import {isMobile} from 'src/mobile';
import {toggleRHS} from 'src/actions';
import {ChannelNamesMap} from 'src/types/backstage';
import {browserHistory, formatText, messageHtmlToComponent} from 'src/webapp_globals';
import FormattedDuration, {formatDuration} from 'src/components/formatted_duration';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import Tooltip from 'src/components/widgets/tooltip';

const Circle = styled.div`
    position: absolute;
    width: 24px;
    height: 24px;
    color: var(--button-bg);
    background: #EFF1F5;
    border-radius: 50%;
    left: 21px;
    top: 5px;

    > .icon {
        font-size: 14px;
        margin: 5px 0 0 2px;
    }
`;

const TimelineItem = styled.li`
    position: relative;
    margin: 27px 0 0 0;
`;

const TimeContainer = styled.div<{parent: 'rhs'|'retro'}>`
    position: absolute;
    width: 75px;
    line-height: 16px;
    text-align: left;
    left: 4px;
    bottom: ${({parent}) => (parent === 'rhs' ? '-28px' : 'auto')};
`;

const TimeStamp = styled.time`
    font-size: 11px;
    margin: 0px;
    line-height: 1;
    font-weight: 500;
    svg {
        vertical-align: middle;
        margin: 0px 3px;
        position: relative;
        top: -1px;
    }
`;

const TimeBetween = styled.div`
    font-size: 10px;
    position: absolute;
    top: -23px;
    left: -10px;
    white-space: nowrap;
    text-align: right;
    width: 3rem;


    &::after {
        content: '';
        background: #EFF1F5;
        width: 7px;
        height: 7px;
        position: absolute;
        top: 5px;
        right: -12px;
        border-radius: 50%;
    }
`;

const SummaryContainer = styled.div`
    position: relative;
    padding: 0 5px 0 55px;
    line-height: 16px;
    min-height: 36px;
`;

const SummaryTitle = styled.div<{deleted: boolean, postIdExists: boolean}>`
    font-size: 12px;
    font-weight: 600;

    ${({deleted, postIdExists}) => (deleted ? css`
        text-decoration: line-through;
    ` : (postIdExists && css`
        :hover {
            cursor: pointer;
        }
    `))}

`;

const SummaryDeleted = styled.span`
    font-size: 10px;
    margin-top: 3px;
    display: inline-block;
`;

const SummaryDetail = styled.div`
    font-size: 11px;
    margin: 4px 0 0 0;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const StyledHoverMenu = styled(HoverMenu)<{parent: 'rhs'|'retro'}>`
    right: ${({parent}) => (parent === 'rhs' ? '20px' : '0')};
`;

const DATETIME_FORMAT = {
    ...DateTime.DATE_MED,
    ...DateTime.TIME_24_WITH_SHORT_OFFSET,
};

interface Props {
    event: TimelineEvent;
    prevEventAt?: DateTime;
    parent: 'rhs' | 'retro';
    runCreateAt: DateTime;
    channelNames: ChannelNamesMap;
    team: Team;
    deleteEvent: () => void;
    editable: boolean;
}

const TimelineEventItem = (props: Props) => {
    const dispatch = useDispatch();
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const markdownOptions = {
        atMentions: true,
        team: props.team,
        channelNamesMap: props.channelNames,
    };
    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };
    const statusPostDeleted =
        props.event.event_type === TimelineEventType.StatusUpdated &&
        props.event.status_delete_at !== 0;

    const goToPost = (e: React.MouseEvent<Element, MouseEvent>, postId?: string) => {
        e.preventDefault();
        if (!postId) {
            return;
        }

        browserHistory.push(`/${props.team.name}/pl/${postId}`);

        if (isMobile()) {
            dispatch(toggleRHS());
        }
    };
    const {formatMessage, formatList} = useIntl();

    const getSummary = (event: TimelineEvent, parsedDetails: unknown) => {
        switch (event.event_type) {
        case TimelineEventType.AssigneeChanged:
        case TimelineEventType.RanSlashCommand:
            return event.subject_display_name + ' ' + event.summary;
        case TimelineEventType.UserJoinedLeft:
            return event.summary;
        case TimelineEventType.ParticipantsChanged: {
            const details = parsedDetails as ParticipantsChangedDetails;
            if (details.action === 'joined') {
                return formatMessage({defaultMessage: '{requester} added {users} to the run'}, {
                    users: formatList(details.users.map((u: string) => `@${u}`), {type: 'conjunction'}),
                    requester: details.requester,
                });
            }
            return formatMessage({defaultMessage: '{requester} removed {users} from the run'}, {
                users: formatList(details.users.map((u: string) => `@${u}`), {type: 'conjunction'}),
                requester: details.requester,
            });
        }
        default:
            return '';
        }
    };
    const getSummaryTitle = (event: TimelineEvent, parsedDetails: unknown) => {
        switch (event.event_type) {
        case TimelineEventType.RunCreated:
            return formatMessage({defaultMessage: 'Run started by {name}'}, {name: event.subject_display_name});
        case TimelineEventType.RunFinished:
            return formatMessage({defaultMessage: 'Run finished by {name}'}, {name: event.subject_display_name});
        case TimelineEventType.RunRestored:
            return formatMessage({defaultMessage: 'Run restored by {name}'}, {name: event.subject_display_name});
        case TimelineEventType.StatusUpdated:
            if (event.summary === '') {
                return formatMessage({defaultMessage: '{name} posted a status update'}, {name: event.subject_display_name});
            }
            return formatMessage({defaultMessage: '{name} changed status from {summary}'}, {name: event.subject_display_name, summary: event.summary});
        case TimelineEventType.StatusUpdateSnoozed:
            return formatMessage({defaultMessage: '{name} snoozed a status update'}, {name: event.subject_display_name});
        case TimelineEventType.StatusUpdateRequested:
            return formatMessage({defaultMessage: '{name} requested a status update'}, {name: event.subject_display_name});
        case TimelineEventType.OwnerChanged:
            return formatMessage({defaultMessage: 'Owner changed from {summary}'}, {summary: event.summary});
        case TimelineEventType.TaskStateModified: {
            const user = event.subject_display_name;
            const {action, task: name} = parsedDetails as TaskStateModifiedDetails;

            switch (action) {
            case 'check':
                return formatMessage({defaultMessage: '{user} checked off checklist item "{name}"'}, {user, name});
            case 'uncheck':
                return formatMessage({defaultMessage: '{user} unchecked checklist item "{name}"'}, {user, name});
            case 'skip':
                return formatMessage({defaultMessage: '{user} skipped checklist item "{name}"'}, {user, name});
            case 'restore':
                return formatMessage({defaultMessage: '{user} restored checklist item "{name}"'}, {user, name});
            default:
                return (event.subject_display_name + ' ' + event.summary).replace(/\*\*/g, '"');
            }
        }
        case TimelineEventType.AssigneeChanged:
            return formatMessage({defaultMessage: 'Assignee Changed'});
        case TimelineEventType.RanSlashCommand:
            return formatMessage({defaultMessage: 'Slash Command Executed'});
        case TimelineEventType.EventFromPost:
            return event.summary;
        case TimelineEventType.UserJoinedLeft: {
            const details = parsedDetails as UserJoinedLeftDetails;

            // old format
            if (details.title) {
                return details.title;
            }

            // new format
            if (details.action === 'joined') {
                return formatMessage({defaultMessage: '@{user} joined the run'}, {user: details.users[0]});
            }
            return formatMessage({defaultMessage: '@{user} left the run'}, {user: details.users[0]});
        }
        case TimelineEventType.ParticipantsChanged: {
            const details = parsedDetails as ParticipantsChangedDetails;
            if (details.users.length > 1) {
                if (details.action === 'joined') {
                    return formatMessage({defaultMessage: '{name} added {num} participants to the run'}, {name: details.requester, num: details.users.length});
                }
                return formatMessage({defaultMessage: '{name} removed {num} participants from the run'}, {name: details.requester, num: details.users.length});
            }
            if (details.action === 'joined') {
                return formatMessage({defaultMessage: '{name} added @{user} to the run'}, {name: details.requester, user: details.users[0]});
            }
            return formatMessage({defaultMessage: '{name} removed @{user} from the run'}, {name: details.requester, user: details.users[0]});
        }
        case TimelineEventType.PublishedRetrospective:
            return formatMessage({defaultMessage: 'Retrospective published by {name}'}, {name: event.subject_display_name});
        case TimelineEventType.CanceledRetrospective:
            return formatMessage({defaultMessage: 'Retrospective canceled by {name}'}, {name: event.subject_display_name});
        case TimelineEventType.StatusUpdatesEnabled:
            return formatMessage({defaultMessage: 'Run status updates enabled by {name}'}, {name: event.subject_display_name});
        case TimelineEventType.StatusUpdatesDisabled:
            return formatMessage({defaultMessage: 'Run status updates disabled by {name}'}, {name: event.subject_display_name});
        default:
            return '';
        }
    };

    const getIcon = (event: TimelineEvent) => {
        switch (event.event_type) {
        case TimelineEventType.RunCreated:
        case TimelineEventType.RunFinished:
        case TimelineEventType.RunRestored:
            return 'icon-shield-alert-outline';
        case TimelineEventType.StatusUpdated:
        case TimelineEventType.StatusUpdateSnoozed:
            return 'icon-flag-outline';
        case TimelineEventType.StatusUpdateRequested:
            return 'icon-update';
        case TimelineEventType.TaskStateModified:
            return 'icon-format-list-bulleted';
        case TimelineEventType.OwnerChanged:
        case TimelineEventType.AssigneeChanged:
        case TimelineEventType.RanSlashCommand:
        case TimelineEventType.PublishedRetrospective:
        case TimelineEventType.EventFromPost:
            return 'icon-pencil-outline';
        case TimelineEventType.UserJoinedLeft:
        case TimelineEventType.ParticipantsChanged:
            return 'icon-account-outline';
        case TimelineEventType.CanceledRetrospective:
            return 'icon-cancel';
        case TimelineEventType.StatusUpdatesEnabled:
        case TimelineEventType.StatusUpdatesDisabled:
            return 'icon-clock-outline';
        default:
            return '';
        }
    };

    const eventTime = DateTime.fromMillis(props.event.event_at);

    const diff = DateTime.fromMillis(props.event.event_at).diff(props.runCreateAt);
    let timeSinceStart: ReactNode = formatMessage({defaultMessage: '{duration} after run started'}, {duration: formatDuration(diff)});
    if (diff.toMillis() < 0) {
        timeSinceStart = formatMessage({defaultMessage: '{duration} before run started'}, {duration: formatDuration(diff.negate())});
    }
    const timeSincePrevEvent: ReactNode = props.prevEventAt && (
        <TimeBetween>
            <FormattedDuration
                from={props.prevEventAt}
                to={props.event.event_at}
                truncate={'truncate'}
            />
        </TimeBetween>
    );

    if (props.event.event_type === TimelineEventType.RunCreated) {
        timeSinceStart = null;
    }

    // enforce one only json parse, it should be json valid
    // but we use the actual string as fallback anyways
    let parsedDetails;
    try {
        parsedDetails = JSON.parse(props.event.details);
    } catch (e) {
        parsedDetails = props.event.details;
    }

    return (
        <TimelineItem
            data-testid={'timeline-item ' + props.event.event_type}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            {props.parent === 'retro' ? (
                <TimeContainer parent={props.parent}>
                    {timeSincePrevEvent}
                </TimeContainer>
            ) : null}
            <Circle>
                <i className={'icon ' + getIcon(props.event)}/>
            </Circle>

            <SummaryContainer>
                <TimeStamp dateTime={eventTime.setZone('Etc/UTC').toISO()}>
                    {eventTime.setZone('Etc/UTC').toLocaleString(DATETIME_FORMAT)}
                    <Tooltip
                        id={`timeline-${props.event.id}`}
                        content={(
                            <>
                                {eventTime.toLocaleString(DATETIME_FORMAT)}
                                <br/>
                                {timeSinceStart}
                            </>
                        )}
                    >
                        <ClockOutlineIcon size={12}/>
                    </Tooltip>
                </TimeStamp>
                <SummaryTitle
                    onClick={(e) => props.editable && !statusPostDeleted && goToPost(e, props.event.post_id)}
                    deleted={statusPostDeleted}
                    postIdExists={props.event.post_id !== '' && props.editable}
                >
                    {getSummaryTitle(props.event, parsedDetails)}
                </SummaryTitle>
                {statusPostDeleted && (
                    <SummaryDeleted>
                        {formatMessage({defaultMessage: 'Deleted: {timestamp}'}, {
                            timestamp: DateTime.fromMillis(props.event.status_delete_at!)
                                .setZone('Etc/UTC')
                                .toLocaleString(DATETIME_FORMAT),
                        })}
                    </SummaryDeleted>
                )}
                <SummaryDetail>{messageHtmlToComponent(formatText(getSummary(props.event, parsedDetails), markdownOptions), true, messageHtmlToComponentOptions)}</SummaryDetail>
            </SummaryContainer>
            {showMenu && props.editable &&
                <StyledHoverMenu parent={props.parent}>
                    <HoverMenuButton
                        className={'icon-trash-can-outline icon-16 btn-icon'}
                        onClick={() => {
                            setShowDeleteConfirm(true);
                        }}
                    />
                </StyledHoverMenu>
            }
            <ConfirmModal
                show={showDeleteConfirm}
                title={formatMessage({defaultMessage: 'Confirm Entry Delete'})}
                message={formatMessage({defaultMessage: 'Are you sure you want to delete this event? Deleted events will be permanently removed from the timeline.'})}
                confirmButtonText={formatMessage({defaultMessage: 'Delete Entry'})}
                onConfirm={() => {
                    props.deleteEvent();
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
            {props.parent === 'rhs' ? (
                <TimeContainer parent={props.parent}>
                    {timeSincePrevEvent}
                </TimeContainer>
            ) : null}
        </TimelineItem>
    );
};

export default TimelineEventItem;
