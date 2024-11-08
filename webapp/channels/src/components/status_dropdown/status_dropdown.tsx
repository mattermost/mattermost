// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import moment from 'moment-timezone';
import React from 'react';
import type {ReactNode} from 'react';
import {injectIntl, FormattedDate, FormattedMessage, FormattedTime, defineMessage, defineMessages} from 'react-intl';
import type {IntlShape, MessageDescriptor} from 'react-intl';

import StatusIcon from '@mattermost/compass-components/components/status-icon'; // eslint-disable-line no-restricted-imports
import Text from '@mattermost/compass-components/components/text'; // eslint-disable-line no-restricted-imports
import type {TUserStatus} from '@mattermost/compass-components/shared'; // eslint-disable-line no-restricted-imports
import {CheckIcon} from '@mattermost/compass-icons/components';
import {PulsatingDot} from '@mattermost/components';
import {CustomStatusDuration} from '@mattermost/types/users';
import type {UserCustomStatus, UserProfile, UserStatus} from '@mattermost/types/users';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusModal from 'components/custom_status/custom_status_modal';
import CustomStatusText from 'components/custom_status/custom_status_text';
import ExpiryTime from 'components/custom_status/expiry_time';
import DndCustomTimePicker from 'components/dnd_custom_time_picker_modal';
import * as Menu from 'components/menu';
import ResetStatusModal from 'components/reset_status_modal';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import MenuOld from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Avatar from 'components/widgets/users/avatar/avatar';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers, UserStatuses} from 'utils/constants';
import {getBrowserTimezone, getCurrentDateTimeForTimezone, getCurrentMomentForTimezone} from 'utils/timezone';

import type {ModalData} from 'types/actions';
import type {Menu as MenuType} from 'types/store/plugins';

import UserAccountAwayMenuItem from './user_account_away_menuitem';
import UserAccountDndMenuItem from './user_account_dnd_menuitem';
import UserAccountLogoutMenuItem from './user_account_logout_menuitem';
import UserAccountNameMenuItem from './user_account_name_menuitem';
import UserAccountOfflineMenuItem from './user_account_offline_menuitem';
import UserAccountOnlineMenuItem from './user_account_online_menuitem';
import UserAccountOutOfOfficeMenuItem from './user_account_out_of_office_menuitem';
import UserAccountProfileMenuItem from './user_account_profile_menuitem';
import UserAccountSetCustomStatusMenuItem from './user_account_set_custom_status_menuitem';

import './status_dropdown.scss';

type Props = {
    intl: IntlShape;
    status?: string;
    userId: string;
    profilePicture?: string;
    autoResetPref?: string;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        setStatus: (status: UserStatus) => void;
        unsetCustomStatus: () => void;
        setStatusDropdown: (open: boolean) => void;
    };
    customStatus?: UserCustomStatus;
    currentUser: UserProfile;
    isCustomStatusEnabled: boolean;
    isCustomStatusExpired: boolean;
    isMilitaryTime: boolean;
    isStatusDropdownOpen: boolean;
    showCustomStatusPulsatingDot: boolean;
    timezone?: string;
    dndEndTime?: number;
}

type State = {
    openUp: boolean;
};

const statusDropdownMessages: Record<string, Record<string, MessageDescriptor>> = {
    dnd: defineMessages({
        name: {
            id: 'status_dropdown.set_dnd',
            defaultMessage: 'Do not disturb',
        },
    }),
};

export class StatusDropdown extends React.PureComponent<Props, State> {
    dndTimes = [
        {id: 'dont_clear', label: defineMessage({id: 'status_dropdown.dnd_sub_menu_item.dont_clear', defaultMessage: 'Don\'t clear'})},
        {id: 'thirty_minutes', label: defineMessage({id: 'status_dropdown.dnd_sub_menu_item.thirty_minutes', defaultMessage: '30 mins'})},
        {id: 'one_hour', label: defineMessage({id: 'status_dropdown.dnd_sub_menu_item.one_hour', defaultMessage: '1 hour'})},
        {id: 'two_hours', label: defineMessage({id: 'status_dropdown.dnd_sub_menu_item.two_hours', defaultMessage: '2 hours'})},
        {id: 'tomorrow', label: defineMessage({id: 'status_dropdown.dnd_sub_menu_item.tomorrow', defaultMessage: 'Tomorrow'})},
        {id: 'custom', label: defineMessage({id: 'status_dropdown.dnd_sub_menu_item.custom', defaultMessage: 'Choose date and time'})},
    ];
    static defaultProps = {
        userId: '',
        profilePicture: '',
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            openUp: false,
            isStatusSet: false,
        };
    }

    setStatus = (status: string, dndEndTime?: number): void => {
        this.props.actions.setStatus({
            user_id: this.props.userId,
            status,
            dnd_end_time: dndEndTime,
        });
    };

    setDnd = (index: number): void => {
        const currentDate = getCurrentMomentForTimezone(this.props.timezone);
        let endTime = currentDate;
        switch (index) {
        case 0:
            endTime = moment(0);
            break;
        case 1:
            // add 30 minutes in current time
            endTime = currentDate.add(30, 'minutes');
            break;
        case 2:
            // add 1 hour in current time
            endTime = currentDate.add(1, 'hour');
            break;
        case 3:
            // add 2 hours in current time
            endTime = currentDate.add(2, 'hours');
            break;
        case 4:
            // set to next day 9 in the morning
            endTime = currentDate.add(1, 'day').set({hour: 9, minute: 0});
            break;
        }

        this.setStatus(UserStatuses.DND, endTime.utc().unix());
    };

    setCustomTimedDnd = (): void => {
        const dndCustomTimePicker = {
            modalId: ModalIdentifiers.DND_CUSTOM_TIME_PICKER,
            dialogType: DndCustomTimePicker,
            dialogProps: {
                currentDate: this.props.timezone ? getCurrentDateTimeForTimezone(this.props.timezone) : new Date(),
            },
        };

        this.props.actions.openModal(dndCustomTimePicker);
    };

    showStatusChangeConfirmation = (status: string): void => {
        const resetStatusModalData = {
            modalId: ModalIdentifiers.RESET_STATUS,
            dialogType: ResetStatusModal,
            dialogProps: {newStatus: status},
        };

        this.props.actions.openModal(resetStatusModalData);
    };

    handleClearStatus = (e: React.MouseEvent<HTMLButtonElement> | React.MouseEvent<HTMLDivElement> | React.TouchEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        this.props.actions.unsetCustomStatus();
    };

    onToggle = (open: boolean): void => {
        this.props.actions.setStatusDropdown(open);
    };

    handleCustomStatusEmojiClick = (event: React.MouseEvent): void => {
        event.stopPropagation();
        const customStatusInputModalData = {
            modalId: ModalIdentifiers.CUSTOM_STATUS,
            dialogType: CustomStatusModal,
        };
        this.props.actions.openModal(customStatusInputModalData);
    };

    renderCustomStatus = (isStatusSet: boolean | undefined): ReactNode => {
        if (!this.props.isCustomStatusEnabled) {
            return null;
        }
        const {customStatus} = this.props;

        let customStatusText;
        let customStatusHelpText;
        switch (true) {
        case isStatusSet && customStatus?.text && customStatus.text.length > 0:
            customStatusText = customStatus?.text;
            break;
        case isStatusSet && !customStatus?.text && customStatus?.duration === CustomStatusDuration.DONT_CLEAR:
            customStatusHelpText = this.props.intl.formatMessage({id: 'status_dropdown.set_custom_text', defaultMessage: 'Set custom status text...'});
            break;
        case isStatusSet && !customStatus?.text && customStatus?.duration !== CustomStatusDuration.DONT_CLEAR:
            customStatusText = '';
            break;
        case !isStatusSet:
            customStatusHelpText = this.props.intl.formatMessage({id: 'status_dropdown.set_custom', defaultMessage: 'Set a custom status'});
        }

        const customStatusEmoji = isStatusSet ? (
            <span className='d-flex'>
                <CustomStatusEmoji
                    showTooltip={false}
                    emojiStyle={{marginLeft: 0}}
                />
            </span>
        ) : (
            <EmojiIcon className={'custom-status-emoji'}/>
        );

        const pulsatingDot = !isStatusSet && this.props.showCustomStatusPulsatingDot && (
            <PulsatingDot/>
        );

        const clearableTooltipText = (
            <FormattedMessage
                id={'input.clear'}
                defaultMessage='Clear'
            />
        );

        const clearButton = isStatusSet && !pulsatingDot && (
            <div
                className={classNames('status-dropdown-menu__clear-container', 'input-clear visible')}
                onClick={this.handleClearStatus}
                onTouchEnd={this.handleClearStatus}
            >
                <WithTooltip
                    id='InputClearTooltip'
                    placement='left'
                    title={clearableTooltipText}
                >
                    <span
                        className='input-clear-x'
                        aria-hidden='true'
                    >
                        <i className='icon icon-close-circle'/>
                    </span>
                </WithTooltip>
            </div>
        );

        const expiryTime = isStatusSet && customStatus?.expires_at && customStatus.duration !== CustomStatusDuration.DONT_CLEAR &&
            (
                <ExpiryTime
                    time={customStatus.expires_at}
                    timezone={this.props.timezone}
                    className={classNames('custom_status__expiry', {
                        padded: customStatus?.text?.length > 0,
                    })}
                    withinBrackets={true}
                />
            );

        return (
            <MenuOld.Group>
                <MenuOld.ItemToggleModalRedux
                    ariaLabel={customStatusText || customStatusHelpText}
                    modalId={ModalIdentifiers.CUSTOM_STATUS}
                    dialogType={CustomStatusModal}
                    className={classNames('MenuItem__primary-text custom_status__row', {
                        flex: customStatus?.text?.length === 0,
                    })}
                    id={'status-menu-custom-status'}
                >
                    <span className='custom_status__container'>
                        <span className='custom_status__icon'>
                            {customStatusEmoji}
                        </span>
                        <CustomStatusText
                            text={customStatusText}
                            className='custom_status__text'
                        />
                        <Text
                            margin='none'
                        >
                            {customStatusHelpText}
                        </Text>
                        {clearButton}
                        {pulsatingDot}
                    </span>
                    {expiryTime}
                </MenuOld.ItemToggleModalRedux>
            </MenuOld.Group>
        );
    };

    renderDndExtraText = (dndEndTime?: number, timezone?: string) => {
        if (!(dndEndTime && dndEndTime > 0)) {
            return this.props.intl.formatMessage({id: 'status_dropdown.set_dnd.extra', defaultMessage: 'Disables all notifications'});
        }

        const tz = timezone || getBrowserTimezone();
        const currentTime = moment().tz(tz);
        const endTime = moment.unix(dndEndTime).tz(tz);

        let formattedEndTime;

        const diffDays = endTime.clone().startOf('day').diff(currentTime.clone().startOf('day'), 'days');

        switch (diffDays) {
        case 0:
            formattedEndTime = (
                <FormattedMessage
                    id='custom_status.expiry.until'
                    defaultMessage='Until {time}'
                    values={{time: endTime.format('h:mm A')}}
                />
            );
            break;
        case 1:
            formattedEndTime = (
                <FormattedMessage
                    id='custom_status.expiry.until_tomorrow'
                    defaultMessage='Until Tomorrow {time}'
                    values={{time: endTime.format('h:mm A')}}
                />
            );
            break;
        default:
            formattedEndTime = (
                <FormattedMessage
                    id='custom_status.expiry.until'
                    defaultMessage='Until {time}'
                    values={{time: endTime.format('lll')}}
                />
            );
        }

        return formattedEndTime;
    };

    render = (): JSX.Element => {
        const {intl} = this.props;
        const {status, customStatus, isCustomStatusExpired, currentUser, timezone, dndEndTime} = this.props;
        const isStatusSet = customStatus && !isCustomStatusExpired && (customStatus.text?.length > 0 || customStatus.emoji?.length > 0);
        const shouldConfirmBeforeStatusChange = this.props.autoResetPref === '' && this.props.status === UserStatuses.OUT_OF_OFFICE;

        const setDnd = shouldConfirmBeforeStatusChange ? () => this.showStatusChangeConfirmation('dnd') : this.setDnd;
        const setCustomTimedDnd = shouldConfirmBeforeStatusChange ? () => this.showStatusChangeConfirmation('dnd') : this.setCustomTimedDnd;

        const selectedIndicator = (
            <CheckIcon
                size={16}
                color={'var(--button-bg)'}
            />
        );

        const dndSubMenuItems = ([
            {
                id: 'dndSubMenu-header',
                direction: 'right',
                text: this.props.intl.formatMessage({id: 'status_dropdown.dnd_sub_menu_header', defaultMessage: 'Clear after:'}),
                isHeader: true,
            },
        ] as MenuType[])?.concat(
            this.dndTimes.map<MenuType>(({id, label}, index) => {
                let text: MenuType['text'] = this.props.intl.formatMessage(label);
                if (index === 4) {
                    const tomorrow = getCurrentMomentForTimezone(this.props.timezone).add(1, 'day').set({hour: 9, minute: 0}).toDate();
                    text = (
                        <>
                            {text}
                            <span className={`dndTime-${id}_timestamp`}>
                                <FormattedDate
                                    value={tomorrow}
                                    weekday='short'
                                    timeZone={this.props.timezone}
                                />
                                {', '}
                                <FormattedTime
                                    value={tomorrow}
                                    timeStyle='short'
                                    hour12={!this.props.isMilitaryTime}
                                    timeZone={this.props.timezone}
                                />
                            </span>
                        </>
                    );
                }
                return {
                    id: `dndTime-${id}`,
                    direction: 'right',
                    text,
                    action:
                        index === 5 ? () => setCustomTimedDnd() : () => setDnd(index),
                };
            }),
        );

        const customStatusComponent = this.renderCustomStatus(isStatusSet);

        let menuAriaLabeltext;
        switch (this.props.status) {
        case UserStatuses.AWAY:
            menuAriaLabeltext = intl.formatMessage({
                id: 'status_dropdown.profile_button_label.away',
                defaultMessage: 'Current status: Away. Select to open profile and status menu.',
            });
            break;
        case UserStatuses.DND:
            menuAriaLabeltext = intl.formatMessage({
                id: 'status_dropdown.profile_button_label.dnd',
                defaultMessage: 'Current status: Do not disturb. Select to open profile and status menu.',
            });
            break;
        case UserStatuses.OFFLINE:
            menuAriaLabeltext = intl.formatMessage({
                id: 'status_dropdown.profile_button_label.offline',
                defaultMessage: 'Current status: Offline. Select to open profile and status menu.',
            });
            break;
        case UserStatuses.ONLINE:
            menuAriaLabeltext = intl.formatMessage({
                id: 'status_dropdown.profile_button_label.online',
                defaultMessage: 'Current status: Online. Select to open profile and status menu.',
            });
            break;
        case UserStatuses.OUT_OF_OFFICE:
            menuAriaLabeltext = intl.formatMessage({
                id: 'status_dropdown.profile_button_label.ooo',
                defaultMessage: 'Current status: Out of office. Select to open profile and status menu.',
            });
            break;
        default:
            menuAriaLabeltext = intl.formatMessage({
                id: 'status_dropdown.profile_button_label',
                defaultMessage: 'Select to open profile and status menu.',
            });
        }

        const dndExtraText = this.renderDndExtraText(dndEndTime, timezone);

        if (true) {
            return (
                <Menu.Container
                    menuButton={{ //TODO: revisit later
                        id: 'status-dropdown-button',
                        dateTestId: 'status-dropdown-button',
                        class: 'status-wrapper style--none',
                        'aria-label': menuAriaLabeltext,
                        children: (<>
                            <CustomStatusEmoji
                                showTooltip={true}
                                tooltipDirection={'bottom'}
                                emojiStyle={{marginRight: '6px'}}
                                onClick={this.handleCustomStatusEmojiClick as () => void}
                            />
                            {
                                this.props.profilePicture && (
                                    <Avatar
                                        size={'sm'}
                                        url={this.props.profilePicture}
                                    />
                                )
                            }
                            <div
                                className='status'
                            >
                                <StatusIcon
                                    size={'sm'}
                                    status={(this.props.status || 'offline') as TUserStatus}
                                />
                            </div>
                        </>),
                    }}
                    menu={{
                        id: 'userAccountMenu',
                        width: '264px',
                    }}
                >
                    <UserAccountNameMenuItem
                        currentUser={currentUser}
                        profilePicture={this.props.profilePicture}
                    />
                    <UserAccountOutOfOfficeMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        isStatusOutOfOffice={this.props.status === UserStatuses.OUT_OF_OFFICE}
                    />
                    <UserAccountSetCustomStatusMenuItem //TODO: revisit later
                        userId={this.props.userId}
                        timezone={this.props.timezone}
                    />
                    <UserAccountOnlineMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        isStatusOnline={this.props.status === UserStatuses.ONLINE}
                    />
                    <UserAccountAwayMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        isStatusAway={this.props.status === UserStatuses.AWAY}
                    />
                    <UserAccountDndMenuItem //TODO: revisit later
                        timezone={this.props.timezone}
                        isStatusDnd={this.props.status === UserStatuses.DND}
                    />
                    <UserAccountOfflineMenuItem
                        userId={this.props.userId}
                        shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                        isStatusOffline={this.props.status === UserStatuses.OFFLINE}
                    />
                    <Menu.Separator/>
                    <UserAccountProfileMenuItem
                        userId={this.props.userId}
                    />
                    <UserAccountLogoutMenuItem/>
                </Menu.Container>
            );
        }

        // eslint-disable-next-line no-unreachable
        return (
            <MenuWrapper
                onToggle={this.onToggle}
                open={this.props.isStatusDropdownOpen}
                className={classNames('status-dropdown-menu status-dropdown-menu-global-header', {
                    active: this.props.isStatusDropdownOpen || isStatusSet,
                })}
            >
                <button
                    className='status-wrapper style--none'
                    aria-label={menuAriaLabeltext}
                    aria-expanded={this.props.isStatusDropdownOpen}
                    aria-controls='statusDropdownMenu'
                >
                    <CustomStatusEmoji
                        showTooltip={true}
                        tooltipDirection={'bottom'}
                        emojiStyle={{marginRight: '6px'}}
                        onClick={this.handleCustomStatusEmojiClick as () => void}
                    />
                    {
                        this.props.profilePicture && (
                            <Avatar
                                size={'sm'}
                                url={this.props.profilePicture}
                                tabIndex={undefined}
                            />
                        )
                    }
                    <div
                        className='status'
                    >
                        <StatusIcon
                            size={'sm'}
                            status={(this.props.status || 'offline') as TUserStatus}
                        />
                    </div>
                </button>
                <MenuOld
                    ariaLabel={this.props.intl.formatMessage({id: 'status_dropdown.menuAriaLabel', defaultMessage: 'Set a status'})}
                    id={'statusDropdownMenu'}
                    listId={'status-drop-down-menu-list'}
                >
                    {customStatusComponent}
                    <MenuOld.Group>
                        <MenuOld.ItemSubMenu
                            subMenu={dndSubMenuItems}
                            ariaLabel={`${this.props.intl.formatMessage(statusDropdownMessages.dnd.name)}. ${dndExtraText}`}
                            text={this.props.intl.formatMessage(statusDropdownMessages.dnd.name)}
                            extraText={dndExtraText}
                            icon={(
                                <StatusIcon
                                    status={'dnd'}
                                    className={'status-icon'}
                                />
                            )}
                            rightDecorator={status === 'dnd' && selectedIndicator}
                            direction={'left'}
                            openUp={this.state.openUp}
                            id={'status-menu-dnd'}
                            action={() => setDnd(0)}
                        />
                    </MenuOld.Group>
                </MenuOld>
            </MenuWrapper>
        );
    };
}
export default injectIntl(StatusDropdown);
