// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessages, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {ShortcutKeys} from '@mattermost/shared/components/shortcut_key';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import * as Menu from 'components/menu';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {ProductRailSection} from 'types/store/views';

import './channel_filter.scss';

const messages = defineMessages({
    disableTooltip: {
        id: 'sidebar_left.channel_filter.showAllChannels',
        defaultMessage: 'Show all channels',
    },
    enableTooltip: {
        id: 'sidebar_left.channel_filter.filterByUnread',
        defaultMessage: 'Filter by unread',
    },
    menuButton: {
        id: 'sidebar_left.channel_filter.menuButton',
        defaultMessage: 'Filter channels',
        description: 'Tooltip and accessible name of the filter button above the channel list while the product navigation rail splits boards from channels. It opens a menu of view options.',
    },
    menu: {
        id: 'sidebar_left.channel_filter.menu',
        defaultMessage: 'Channel filters',
        description: 'Accessible name of the menu of view options opened from the filter button above the channel list.',
    },
    unreadsOnly: {
        id: 'sidebar_left.channel_filter.unreadsOnly',
        defaultMessage: 'Unreads only',
        description: 'Checkbox item in the channel filter menu. When checked, the channel list shows only unread channels.',
    },
    showBoards: {
        id: 'sidebar_left.channel_filter.showBoards',
        defaultMessage: 'Show boards',
        description: 'Checkbox item in the channel filter menu, shown in the Channels view of the product navigation rail. When checked, boards are listed alongside channels instead of only under Boards.',
    },
});

// The menu item is the control, announced as a checkbox with its state; this only shows that state.
// It's kept out of the tab order and the accessibility tree, and takes no clicks, since a click on
// its label would also toggle the item a second time.
const checkbox = (checked: boolean) => (
    <span
        className='SidebarFilters_menuCheckbox'
        aria-hidden='true'
    >
        <Checkbox
            checked={checked}
            readOnly={true}
            tabIndex={-1}
        />
    </span>
);

const shortcut = {
    default: [ShortcutKeys.ctrl, ShortcutKeys.shift, 'U'],
    mac: [ShortcutKeys.cmd, ShortcutKeys.shift, 'U'],
};

type Props = {
    intl: IntlShape;
    unreadFilterEnabled: boolean;

    // Set while the product rail splits boards from channels, which turns the button into a menu.
    productRailSection?: ProductRailSection | null;
    boardsShownInChannels?: boolean;
    actions: {
        setUnreadFilterEnabled: (enabled: boolean) => void;
        setBoardsShownInChannels?: (shown: boolean) => void;
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

        this.props.actions.setUnreadFilterEnabled(!unreadFilterEnabled);
    };

    toggleBoardsShown = () => {
        this.props.actions.setBoardsShownInChannels?.(!this.props.boardsShownInChannels);
    };

    // While the product rail splits boards from channels, the button opens a menu: the unread
    // filter, and in Channels, whether to list boards there too.
    renderMenu() {
        const {intl, unreadFilterEnabled, productRailSection, boardsShownInChannels} = this.props;
        const label = intl.formatMessage(messages.menuButton);

        return (
            <div className='SidebarFilters'>
                <Menu.Container
                    menuButton={{
                        id: 'sidebarChannelFilterMenuButton',
                        class: classNames('SidebarFilters_filterButton', {active: unreadFilterEnabled}),
                        dataTestId: 'sidebar-unread-filter-button',
                        'aria-label': label,
                        children: <i className='icon icon-filter-variant'/>,
                    }}
                    menuButtonTooltip={{text: label}}
                    menu={{
                        id: 'sidebarChannelFilterMenu',
                        'aria-label': intl.formatMessage(messages.menu),
                    }}
                >
                    <Menu.Item
                        id='sidebarChannelFilterMenu-unreadsOnly'
                        role='menuitemcheckbox'
                        aria-checked={unreadFilterEnabled}
                        leadingElement={checkbox(unreadFilterEnabled)}
                        labels={<span>{intl.formatMessage(messages.unreadsOnly)}</span>}
                        onClick={this.toggleUnreadFilter}
                    />
                    {productRailSection === 'channels' && (
                        <Menu.Item
                            id='sidebarChannelFilterMenu-showBoards'
                            role='menuitemcheckbox'
                            aria-checked={Boolean(boardsShownInChannels)}
                            leadingElement={checkbox(Boolean(boardsShownInChannels))}
                            labels={<span>{intl.formatMessage(messages.showBoards)}</span>}
                            onClick={this.toggleBoardsShown}
                        />
                    )}
                </Menu.Container>
            </div>
        );
    }

    render() {
        const {intl, unreadFilterEnabled} = this.props;

        if (this.props.productRailSection) {
            return this.renderMenu();
        }

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
                        data-testid='sidebar-unread-filter-button'
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
