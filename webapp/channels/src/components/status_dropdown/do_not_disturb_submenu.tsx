// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';
import {useSelector} from 'react-redux';

// eslint-disable-next-line no-restricted-imports
import StatusIcon from '@mattermost/compass-components/components/status-icon';
import {ChevronRightIcon} from '@mattermost/compass-icons/components';

import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import * as Menu from 'components/menu';

import {Preferences} from 'utils/constants';
import {getCurrentMomentForTimezone} from 'utils/timezone';

import type {GlobalState} from 'types/store';

function DoNotDisturbSubmenu() {
    const timezone = useSelector(getCurrentTimezone);

    const isMilitaryTime = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false));

    const tomorrow9AMDateObject = getCurrentMomentForTimezone(timezone).add(1, 'day').set({hour: 9, minute: 0}).toDate();

    return (
        <Menu.SubMenu
            id='userAccountPopover.menuItem.dnd'
            leadingElement={
                <StatusIcon
                    status='dnd'
                />
            }
            labels={
                <>
                    <FormattedMessage
                        id='userAccountPopover.menuItem.dnd'
                        defaultMessage='Do not disturb'
                    />
                    <FormattedMessage
                        id='userAccountPopover.menuItem.dnd.secondaryLabel.disablesAllNotifications'
                        defaultMessage='Disables all notifications'
                    />
                </>
            }
            trailingElements={<ChevronRightIcon size={16}/>}
            menuId='userAccountPopover.dndSubMenu'
        >
            <h5 className={'dot-menu__post-reminder-menu-header'}>
                <FormattedMessage
                    id='userAccountPopover.doNotDisturbSubMenu.menuItem.clearAfter'
                    defaultMessage='Clear after:'
                />
            </h5>
            <Menu.Item
                id='userAccountPopover.doNotDisturbSubMenu.menuItem.doNotClear'
                labels={
                    <FormattedMessage
                        id='userAccountPopover.doNotDisturbSubMenu.menuItem.doNotClear'
                        defaultMessage="Don't clear"
                    />
                }
            />
            <Menu.Item
                id='userAccountPopover.doNotDisturbSubMenu.menuItem.30Minutes'
                labels={
                    <FormattedMessage
                        id='userAccountPopover.doNotDisturbSubMenu.menuItem.30Minutes'
                        defaultMessage='30 mins'
                    />
                }
            />
            <Menu.Item
                id='userAccountPopover.doNotDisturbSubMenu.menuItem.1Hour'
                labels={
                    <FormattedMessage
                        id='userAccountPopover.doNotDisturbSubMenu.menuItem.1Hour'
                        defaultMessage='1 hour'
                    />
                }
            />
            <Menu.Item
                id='userAccountPopover.doNotDisturbSubMenu.menuItem.2Hours'
                labels={
                    <FormattedMessage
                        id='userAccountPopover.doNotDisturbSubMenu.menuItem.2Hours'
                        defaultMessage='2 hours'
                    />
                }
            />
            <Menu.Item
                id='userAccountPopover.doNotDisturbSubMenu.menuItem.tomorrow'
                labels={
                    <FormattedMessage
                        id='userAccountPopover.doNotDisturbSubMenu.menuItem.tomorrow'
                        defaultMessage='Tomorrow'
                    />
                }
                trailingElements={
                    <FormattedMessage
                        id='userAccountPopover.doNotDisturbSubMenu.menuItem.tomorrowsDateTime'
                        defaultMessage='{shortDay}, {shortTime}'
                        values={{
                            shortDay: (
                                <FormattedDate
                                    value={tomorrow9AMDateObject}
                                    weekday='short'
                                    timeZone={timezone}
                                />
                            ),
                            shortTime: (
                                <FormattedTime
                                    value={tomorrow9AMDateObject}
                                    timeStyle='short'
                                    hour12={!isMilitaryTime}
                                    timeZone={timezone}
                                />
                            ),
                        }}
                    />
                }
            />
            <Menu.Item
                id='userAccountPopover.doNotDisturbSubMenu.menuItem.custom'
                labels={
                    <FormattedMessage
                        id='userAccountPopover.doNotDisturbSubMenu.menuItem.custom'
                        defaultMessage='Choose date and time'
                    />
                }
            />
        </Menu.SubMenu>
    );
}

export default DoNotDisturbSubmenu;
