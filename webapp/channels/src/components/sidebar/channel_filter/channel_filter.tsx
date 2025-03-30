// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessages, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import WithTooltip from 'components/with_tooltip';
import {ShortcutKeys} from 'components/with_tooltip/tooltip_shortcut';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

const messages = defineMessages({
    disableTooltip: {
        id: 'sidebar_left.channel_filter.showAllChannels',
        defaultMessage: 'Show all channels',
    },
    enableTooltip: {
        id: 'sidebar_left.channel_filter.filterByUnread',
        defaultMessage: 'Filter by unread',
    },
});

const shortcut = {
    default: [ShortcutKeys.ctrl, ShortcutKeys.shift, 'U'],
    mac: [ShortcutKeys.cmd, ShortcutKeys.shift, 'U'],
};

type Props = {
    intl: IntlShape;
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
        const {intl, unreadFilterEnabled} = this.props;

        const unreadsAriaLabel = intl.formatMessage({id: 'sidebar_left.channel_filter.filterUnreadAria', defaultMessage: 'unreads filter'});

        return (
            <div className='SidebarFilters'>
                <WithTooltip
                    title={unreadFilterEnabled ? messages.disableTooltip : messages.enableTooltip}
                    shortcut={shortcut}
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
                </WithTooltip>
            </div>
        );
    }
}

export default injectIntl(ChannelFilter);
