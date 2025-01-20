// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React, {useMemo} from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {FormattedDate, FormattedMessage, FormattedTime, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CheckIcon, ChevronRightIcon, MinusCircleIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {setStatus} from 'mattermost-redux/actions/users';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getDndEndTimeForUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import DndCustomTimePicker from 'components/dnd_custom_time_picker_modal';
import * as Menu from 'components/menu';
import ResetStatusModal from 'components/reset_status_modal';

import {ModalIdentifiers, Preferences, UserStatuses} from 'utils/constants';
import {getCurrentMomentForTimezone, getBrowserTimezone, getCurrentDateTimeForTimezone} from 'utils/timezone';

import type {GlobalState} from 'types/store';

interface Props {
    userId: UserProfile['id'];
    timezone?: string;
    shouldConfirmBeforeStatusChange: boolean;
    isStatusDnd: boolean;
}

export default function UserAccountDndMenuItem(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const dndEndTime = useSelector((state: GlobalState) => getDndEndTimeForUserId(state, props.userId));

    const isMilitaryTime = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false));

    const tomorrow9AMDateObject = getCurrentMomentForTimezone(props.timezone).add(1, 'day').set({hour: 9, minute: 0}).toDate();

    function openCustomTimePicker() {
        if (props.shouldConfirmBeforeStatusChange) {
            dispatch(openModal({
                modalId: ModalIdentifiers.RESET_STATUS,
                dialogType: ResetStatusModal,
                dialogProps: {
                    newStatus: UserStatuses.DND,
                },
            }));
        } else {
            dispatch(openModal({
                modalId: ModalIdentifiers.DND_CUSTOM_TIME_PICKER,
                dialogType: DndCustomTimePicker,
                dialogProps: {
                    currentDate: props.timezone ? getCurrentDateTimeForTimezone(props.timezone) : new Date(),
                },
            }));
        }
    }

    function handleSubMenuItemClick(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) {
        if (props.shouldConfirmBeforeStatusChange) {
            dispatch(openModal({
                modalId: ModalIdentifiers.RESET_STATUS,
                dialogType: ResetStatusModal,
                dialogProps: {
                    newStatus: UserStatuses.DND,
                },
            }));
            return;
        }

        const {currentTarget: {id}} = event;

        const currentDate = getCurrentMomentForTimezone(props.timezone);

        let endTime = currentDate;
        switch (id) {
        case DND_SUB_MENU_ITEMS_IDS.DO_NOT_CLEAR:
            endTime = moment(0);
            break;
        case DND_SUB_MENU_ITEMS_IDS.THIRTY_MINUTES:
            // add 30 minutes in current time
            endTime = currentDate.add(30, 'minutes');
            break;
        case DND_SUB_MENU_ITEMS_IDS.ONE_HOUR:
            // add 1 hour in current time
            endTime = currentDate.add(1, 'hour');
            break;
        case DND_SUB_MENU_ITEMS_IDS.TWO_HOURS:
            // add 2 hours in current time
            endTime = currentDate.add(2, 'hours');
            break;
        case DND_SUB_MENU_ITEMS_IDS.TOMORROW:
            // set to next day 9 in the morning
            endTime = currentDate.add(1, 'day').set({hour: 9, minute: 0});
            break;
        }

        dispatch(setStatus({
            user_id: props.userId,
            status: UserStatuses.DND,
            dnd_end_time: endTime.utc().unix(),
        }));
    }

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

    // This function has dual purpose, first it returns the secondary label for the menu item and
    // second it returns the part of the aria label for the menu item.
    function getSecondaryLabel(isStatusDnd: boolean, dndEndTime?: number, timezone?: string) {
        if (!isStatusDnd) {
            return formatMessage({
                id: 'userAccountMenu.dndMenuItem.secondaryLabel',
                defaultMessage: 'Disables all notifications',
            });
        }

        // When DND is set to not clear
        if (!dndEndTime || dndEndTime === 0) {
            return formatMessage({
                id: 'userAccountMenu.dndMenuItem.secondaryLabel.doNotClear',
                defaultMessage: 'Until indefinitely',
            });
        }

        const tz = timezone || getBrowserTimezone();
        const currentTime = moment().tz(tz);
        const endTime = moment.unix(dndEndTime).tz(tz);

        const diffDays = endTime.clone().startOf('day').diff(currentTime.clone().startOf('day'), 'days');

        if (diffDays === 0) {
            return formatMessage({
                id: 'userAccountMenu.dndMenuItem.secondaryLabel.untilTodaySomeTime',
                defaultMessage: 'Until {time}',
            }, {
                time: endTime.format('h:mm A'),
            });
        } else if (diffDays === 1) {
            return formatMessage({
                id: 'userAccountMenu.dndMenuItem.secondaryLabel.untilTomorrowSomeTime',
                defaultMessage: 'Until tomorrow {time}',
            }, {
                time: endTime.format('h:mm A'),
            });
        }

        return formatMessage({
            id: 'userAccountMenu.dndMenuItem.secondaryLabel.untilLaterSomeTime',
            defaultMessage: 'Until {time}',
        }, {
            time: endTime.format('lll'),
        });
    }

    return (
        <Menu.SubMenu
            id='userAccountMenu.dndMenuItem'
            menuId='userAccountMenu.dndSubMenu'
            menuAriaDescribedBy='userAccountMenu_dndSubMenuTitle'
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
                    <span>
                        {getSecondaryLabel(props.isStatusDnd, dndEndTime, props.timezone)}
                    </span>
                </>
            }
            role='menuitemradio' // Prevents menu item from closing, not a recommended solution
            aria-checked={props.isStatusDnd}
            trailingElements={trailingElement}
        >
            <h5
                id='userAccountMenu_dndSubMenuTitle'
                className='userAccountMenu_dndMenuItem_subMenuTitle'
                aria-hidden={true}
            >
                {formatMessage({
                    id: 'userAccountMenu.dndSubMenu.title',
                    defaultMessage: 'Clear after:',
                })}
            </h5>
            <Menu.Item
                id={DND_SUB_MENU_ITEMS_IDS.DO_NOT_CLEAR}
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.doNotClear'
                        defaultMessage="Don't clear"
                    />
                }
                onClick={handleSubMenuItemClick}
            />
            <Menu.Item
                id={DND_SUB_MENU_ITEMS_IDS.THIRTY_MINUTES}
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.30Minutes'
                        defaultMessage='30 mins'
                    />
                }
                onClick={handleSubMenuItemClick}
            />
            <Menu.Item
                id={DND_SUB_MENU_ITEMS_IDS.ONE_HOUR}
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.1Hour'
                        defaultMessage='1 hour'
                    />
                }
                onClick={handleSubMenuItemClick}
            />
            <Menu.Item
                id={DND_SUB_MENU_ITEMS_IDS.TWO_HOURS}
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.2Hours'
                        defaultMessage='2 hours'
                    />
                }
                onClick={handleSubMenuItemClick}
            />
            <Menu.Item
                id={DND_SUB_MENU_ITEMS_IDS.TOMORROW}
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
                onClick={handleSubMenuItemClick}
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='userAccountMenu.dndSubMenuItem.custom'
                        defaultMessage='Choose date and time'
                    />
                }
                onClick={openCustomTimePicker}
            />
        </Menu.SubMenu>
    );
}

const DND_SUB_MENU_ITEMS_IDS = {
    DO_NOT_CLEAR: 'userAccountMenu.dndSubMenuItem.doNotClear',
    THIRTY_MINUTES: 'userAccountMenu.dndSubMenuItem.30Minutes',
    ONE_HOUR: 'userAccountMenu.dndSubMenuItem.1Hour',
    TWO_HOURS: 'userAccountMenu.dndSubMenuItem.2Hours',
    TOMORROW: 'userAccountMenu.dndSubMenuItem.tomorrow',
};
