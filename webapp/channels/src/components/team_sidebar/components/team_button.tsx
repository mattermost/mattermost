// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Draggable} from 'react-beautiful-dnd';
import {injectIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import {mark, trackEvent} from 'actions/telemetry_actions.jsx';

import CopyUrlContextMenu from 'components/copy_url_context_menu';
import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import Constants from 'utils/constants';
import {isDesktopApp} from 'utils/user_agent';
import {localizeMessage} from 'utils/utils';

import type {IntlShape} from 'react-intl';

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
    intl: IntlShape;
    isDraggable?: boolean;
    teamIndex?: number;
    teamId?: string;
    isInProduct?: boolean;
    hasUrgent?: boolean;
}

class TeamButton extends React.PureComponent<Props> {
    handleSwitch = (e: React.MouseEvent) => {
        mark('TeamLink#click');
        e.preventDefault();
        this.props.switchTeam(this.props.url);

        setTimeout(() => {
            trackEvent('ui', 'ui_team_sidebar_switch_team');
        }, 0);
    };

    render() {
        const {teamIconUrl, displayName, btnClass, mentions, unread, isDraggable = false, teamIndex, teamId, order} = this.props;
        const {formatMessage} = this.props.intl;

        let teamClass: string = this.props.active ? 'active' : '';
        const isNotCreateTeamButton: boolean = !this.props.url.endsWith('create_team') && !this.props.url.endsWith('select_team');

        let badge: JSX.Element | undefined;

        let ariaLabel = formatMessage({
            id: 'team.button.ariaLabel',
            defaultMessage: '{teamName} team',
        },
        {
            teamName: displayName,
        });

        if (!teamClass) {
            if (unread && !this.props.isInProduct) {
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
                    <span className={classNames('badge badge-max-number pull-right small', {urgent: this.props.hasUrgent})}>{mentions > 99 ? '99+' : mentions}</span>
                );
            }
        }

        ariaLabel = ariaLabel.toLowerCase();

        const content = (
            <TeamIcon
                className={teamClass}
                withHover={true}
                content={this.props.content || displayName || ''}
                url={teamIconUrl}
            />
        );

        let toolTip = this.props.tip || localizeMessage('team.button.name_undefined', 'This team does not have a name');
        let orderIndicator: JSX.Element | undefined;
        if (typeof this.props.order !== 'undefined' && this.props.order < 10) {
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

            if (this.props.showOrder) {
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
                placement={this.props.placement}
                overlay={
                    <Tooltip id={`tooltip-${this.props.url}`}>
                        {toolTip}
                    </Tooltip>
                }
            >
                <div className={'team-btn ' + btnClass}>
                    {!this.props.isInProduct && badge}
                    {content}
                </div>
            </OverlayTrigger>
        );

        let teamButton = (
            <Link
                id={`${this.props.url.slice(1)}TeamButton`}
                aria-label={ariaLabel}
                to={this.props.url}
                onClick={this.handleSwitch}
            >
                {btn}
            </Link>
        );

        if (isDesktopApp()) {
            // if this is not a "special" team button, give it a context menu
            if (isNotCreateTeamButton) {
                teamButton = (
                    <CopyUrlContextMenu
                        link={this.props.url}
                        menuId={this.props.url}
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
}

export default injectIntl(TeamButton);
