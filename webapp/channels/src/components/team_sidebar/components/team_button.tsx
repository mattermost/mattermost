// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {Draggable} from 'react-beautiful-dnd';
import {Tooltip} from 'react-bootstrap';
import {defineMessages, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import {mark, trackEvent} from 'actions/telemetry_actions.jsx';

import CopyUrlContextMenu from 'components/copy_url_context_menu';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import Constants from 'utils/constants';
import {isDesktopApp} from 'utils/user_agent';

const messages = defineMessages({
    nameUndefined: {
        id: 'team.button.name_undefined',
        defaultMessage: 'This team does not have a name',
    },
});

interface Props {
    btnClass?: string;
    url: string;
    displayName?: string;
    content?: React.ReactNode;
    tip: string | JSX.Element;
    order?: number;
    showOrder?: boolean;
    active?: boolean;
    unread?: boolean;
    mentions?: number;
    placement?: 'left' | 'right' | 'top' | 'bottom';
    teamIconUrl?: string | null;
    switchTeam: (url: string) => void;
    isDraggable?: boolean;
    teamIndex?: number;
    teamId?: string;
    isInProduct?: boolean;
    hasUrgent?: boolean;
}

export default function TeamButton({
    btnClass,
    url,
    displayName,
    order,
    unread,
    mentions,
    teamIconUrl,
    isDraggable = false,
    switchTeam,
    teamIndex,
    teamId,
    ...props
}: Props) {
    const {formatMessage} = useIntl();

    const handleSwitch = useCallback((e: React.MouseEvent) => {
        mark('TeamLink#click');
        e.preventDefault();
        switchTeam(url);

        setTimeout(() => {
            trackEvent('ui', 'ui_team_sidebar_switch_team');
        }, 0);
    }, [switchTeam, url]);

    let teamClass: string = props.active ? 'active' : '';
    const isNotCreateTeamButton: boolean = !url.endsWith('create_team') && !url.endsWith('select_team');

    let badge: JSX.Element | undefined;

    let ariaLabel = formatMessage({
        id: 'team.button.ariaLabel',
        defaultMessage: '{teamName} team',
    },
    {
        teamName: displayName,
    });

    if (!teamClass) {
        if (unread && !props.isInProduct) {
            teamClass = 'unread';

            badge = (
                <span className={'unread-badge'}/>
            );
        } else if (isNotCreateTeamButton) {
            teamClass = '';
        } else {
            teamClass = 'special';
        }
        ariaLabel = formatMessage({
            id: 'team.button.unread.ariaLabel',
            defaultMessage: '{teamName} team unread',
        },
        {
            teamName: displayName,
        });

        if (mentions) {
            ariaLabel = formatMessage({
                id: 'team.button.mentions.ariaLabel',
                defaultMessage: '{teamName} team, {mentionCount} mentions',
            },
            {
                teamName: displayName,
                mentionCount: mentions,
            });

            badge = (
                <span className={classNames('badge badge-max-number pull-right small', {urgent: props.hasUrgent})}>{mentions > 99 ? '99+' : mentions}</span>
            );
        }
    }

    ariaLabel = ariaLabel.toLowerCase();

    const content = (
        <TeamIcon
            className={teamClass}
            withHover={true}
            content={props.content || displayName || ''}
            url={teamIconUrl}
        />
    );

    let toolTip = props.tip || formatMessage(messages.nameUndefined);
    let orderIndicator: JSX.Element | undefined;
    if (typeof order !== 'undefined' && order < 10) {
        toolTip = (
            <>
                {toolTip}
                <KeyboardShortcutSequence
                    shortcut={KEYBOARD_SHORTCUTS.teamNavigation}
                    values={{order}}
                    hideDescription={true}
                    isInsideTooltip={true}
                />
            </>
        );

        if (props.showOrder) {
            orderIndicator = (
                <div className='order-indicator'>
                    {order}
                </div>
            );
        }
    }

    const btn = (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement={props.placement}
            overlay={
                <Tooltip id={`tooltip-${url}`}>
                    {toolTip}
                </Tooltip>
            }
        >
            <div className={'team-btn ' + btnClass}>
                {!props.isInProduct && badge}
                {content}
            </div>
        </OverlayTrigger>
    );

    let teamButton = (
        <Link
            id={`${url.slice(1)}TeamButton`}
            aria-label={ariaLabel}
            to={url}
            onClick={handleSwitch}
        >
            {btn}
        </Link>
    );

    if (isDesktopApp()) {
        // if this is not a "special" team button, give it a context menu
        if (isNotCreateTeamButton) {
            teamButton = (
                <CopyUrlContextMenu
                    link={url}
                    menuId={url}
                >
                    {teamButton}
                </CopyUrlContextMenu>
            );
        }
    }

    return isDraggable ? (
        <Draggable
            draggableId={teamId!}
            index={teamIndex!}
        >
            {(provided, snapshot) => {
                return (
                    <div
                        className='draggable-team-container'
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                    >
                        <div

                            className={classNames([`team-container ${teamClass}`, {isDragging: snapshot.isDragging}])}
                        >
                            {teamButton}
                            {orderIndicator}
                        </div>
                    </div>
                );
            }}
        </Draggable>
    ) : (
        <div className={`team-container ${teamClass}`}>
            {teamButton}
            {orderIndicator}
        </div>
    );
}
