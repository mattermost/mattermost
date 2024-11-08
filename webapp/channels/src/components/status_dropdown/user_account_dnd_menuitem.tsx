// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CheckIcon, ChevronRightIcon, MinusCircleIcon} from '@mattermost/compass-icons/components';

import {setStatus} from 'mattermost-redux/actions/users';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import * as Menu from 'components/menu';

import {Preferences} from 'utils/constants';
import {getCurrentMomentForTimezone} from 'utils/timezone';

import type {GlobalState} from 'types/store';

interface Props {
    timezone?: string;
    isStatusDnd: boolean;
}

export default function UserAccountDndMenuItem(props: Props) {
    const dispatch = useDispatch();

    const isMilitaryTime = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false));

    const tomorrow9AMDateObject = getCurrentMomentForTimezone(props.timezone).add(1, 'day').set({hour: 9, minute: 0}).toDate();

    const trailingElement = useMemo(() => {
        if (props.isStatusDnd) {
            return (
                <>
                    <CheckIcon
                        size={16}
                        className='userAccountMenu_menuItemTrailingCheckIcon'
                    />
                    <ChevronRightIcon size={16}/>
                </>
            );
        }

        return (
            <ChevronRightIcon size={16}/>
        );
    }, [props.isStatusDnd]);

    return (
        <Menu.SubMenu
            id='userAccountMenu.dndMenuItem'
            leadingElement={
                <MinusCircleIcon
                    size='18'
                    className='userAccountMenu_dndMenuItem_icon'
                />
            }
            labels={
                <>
                    <FormattedMessage
                        id='userAccountMenu.dndMenuItem.primaryLabel'
                        defaultMessage='Do not disturb'
                    />
                    <FormattedMessage
                        id='userAccountMenu.dndMenuItem.secondaryLabel'
                        defaultMessage='Disables all notifications'
                    />
                </>
            }
            trailingElements={trailingElement}
            menuId='userAccountMenu.dndSubMenu'
        >
            <h5>
                <FormattedMessage
                    id='userAccountMenu.dndSubMenu.title'
                    defaultMessage='Clear after:'
                />
            </h5>
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.doNotClear'
                        defaultMessage="Don't clear"
                    />
                }
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.30Minutes'
                        defaultMessage='30 mins'
                    />
                }
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.1Hour'
                        defaultMessage='1 hour'
                    />
                }
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.2Hours'
                        defaultMessage='2 hours'
                    />
                }
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.tomorrow'
                        defaultMessage='Tomorrow'
                    />
                }
                trailingElements={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.tomorrowsDateTime'
                        defaultMessage='{shortDay}, {shortTime}'
                        values={{
                            shortDay: (
                                <FormattedDate
                                    value={tomorrow9AMDateObject}
                                    weekday='short'
                                    timeZone={props.timezone}
                                />
                            ),
                            shortTime: (
                                <FormattedTime
                                    value={tomorrow9AMDateObject}
                                    timeStyle='short'
                                    hour12={!isMilitaryTime}
                                    timeZone={props.timezone}
                                />
                            ),
                        }}
                    />
                }
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.custom'
                        defaultMessage='Choose date and time'
                    />
                }
            />
        </Menu.SubMenu>
    );
}
