// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

type Props = {
    intl: IntlShape;
    hasMultipleTeams: boolean;
    unreadFilterEnabled: boolean;
    actions: {
        setUnreadFilterEnabled: (enabled: boolean) => void;
    };
};

export class ChannelFilter extends React.PureComponent<Props> {
    componentDidMount() {
        document.addEventListener('keydown', this.handleUnreadFilterKeyPress);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleUnreadFilterKeyPress);
    }

    handleUnreadFilterClick = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        this.toggleUnreadFilter();
    };

    handleUnreadFilterKeyPress = (e: KeyboardEvent) => {
        if (Keyboard.cmdOrCtrlPressed(e) && e.shiftKey && Keyboard.isKeyPressed(e, Constants.KeyCodes.U)) {
            e.preventDefault();
            e.stopPropagation();
            this.toggleUnreadFilter();
        }
    };

    toggleUnreadFilter = () => {
        const {unreadFilterEnabled} = this.props;

        if (unreadFilterEnabled) {
            trackEvent('ui', 'ui_sidebar_unread_filter_disabled');
        } else {
            trackEvent('ui', 'ui_sidebar_unread_filter_enabled');
        }

        this.props.actions.setUnreadFilterEnabled(!unreadFilterEnabled);
    };

    render() {
        const {intl, unreadFilterEnabled, hasMultipleTeams} = this.props;

        let tooltipMessage = intl.formatMessage({id: 'sidebar_left.channel_filter.filterByUnread', defaultMessage: 'Filter by unread'});

        if (unreadFilterEnabled) {
            tooltipMessage = intl.formatMessage({id: 'sidebar_left.channel_filter.showAllChannels', defaultMessage: 'Show all channels'});
        }

        const unreadsAriaLabel = intl.formatMessage({id: 'sidebar_left.channel_filter.filterUnreadAria', defaultMessage: 'unreads filter'});

        const tooltip = (
            <Tooltip
                id='new-group-tooltip'
                className='hidden-xs'
            >
                {tooltipMessage}
                <KeyboardShortcutSequence
                    shortcut={KEYBOARD_SHORTCUTS.navToggleUnreads}
                    hideDescription={true}
                    isInsideTooltip={true}
                />
            </Tooltip>
        );

        return (
            <div className='SidebarFilters'>
                <OverlayTrigger
                    delayShow={500}
                    placement={hasMultipleTeams ? 'top' : 'right'}
                    overlay={tooltip}
                >
                    <a
                        href='#'
                        className={classNames('SidebarFilters_filterButton', {
                            active: unreadFilterEnabled,
                        })}
                        onClick={this.toggleUnreadFilter}
                        aria-label={unreadsAriaLabel}
                    >
                        <i className='icon icon-filter-variant'/>
                    </a>
                </OverlayTrigger>
            </div>
        );
    }
}

export default injectIntl(ChannelFilter);
