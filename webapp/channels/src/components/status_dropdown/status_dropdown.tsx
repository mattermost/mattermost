// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {injectIntl, FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';
import type {IntlShape} from 'react-intl';

import classNames from 'classnames';

import StatusIcon from '@mattermost/compass-components/components/status-icon'; // eslint-disable-line no-restricted-imports
import Text from '@mattermost/compass-components/components/text'; // eslint-disable-line no-restricted-imports
import type {TUserStatus} from '@mattermost/compass-components/shared'; // eslint-disable-line no-restricted-imports
import {AccountOutlineIcon, CheckIcon, ExitToAppIcon} from '@mattermost/compass-icons/components';
import {PulsatingDot} from '@mattermost/components';
import type {PreferenceType} from '@mattermost/types/preferences';
import {CustomStatusDuration} from '@mattermost/types/users';
import type {UserCustomStatus, UserProfile, UserStatus} from '@mattermost/types/users';

import type {ActionFunc} from 'mattermost-redux/types/actions';

import * as GlobalActions from 'actions/global_actions';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusModal from 'components/custom_status/custom_status_modal';
import CustomStatusText from 'components/custom_status/custom_status_text';
import ExpiryTime from 'components/custom_status/expiry_time';
import DndCustomTimePicker from 'components/dnd_custom_time_picker_modal';
import {OnboardingTaskCategory, OnboardingTasksName, TaskNameMapToSteps, CompleteYourProfileTour} from 'components/onboarding_tasks';
import OverlayTrigger from 'components/overlay_trigger';
import ResetStatusModal from 'components/reset_status_modal';
import Tooltip from 'components/tooltip';
import UserSettingsModal from 'components/user_settings/modal';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Avatar from 'components/widgets/users/avatar/avatar';
import type {TAvatarSizeToken} from 'components/widgets/users/avatar/avatar';

import type {ModalData} from 'types/actions';
import {Constants, ModalIdentifiers, UserStatuses} from 'utils/constants';
import {t} from 'utils/i18n';
import {getCurrentDateTimeForTimezone, getCurrentMomentForTimezone} from 'utils/timezone';
import {localizeMessage} from 'utils/utils';

import './status_dropdown.scss';

type Props = {
    intl: IntlShape;
    status?: string;
    userId: string;
    profilePicture?: string;
    autoResetPref?: string;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        setStatus: (status: UserStatus) => ActionFunc;
        unsetCustomStatus: () => ActionFunc;
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
        setStatusDropdown: (open: boolean) => void;
    };
    customStatus?: UserCustomStatus;
    currentUser: UserProfile;
    isCustomStatusEnabled: boolean;
    isCustomStatusExpired: boolean;
    isMilitaryTime: boolean;
    isStatusDropdownOpen: boolean;
    showCompleteYourProfileTour: boolean;
    showCustomStatusPulsatingDot: boolean;
    timezone?: string;
}

type State = {
    openUp: boolean;
    width: number;
    isStatusSet: boolean;
};

export class StatusDropdown extends React.PureComponent<Props, State> {
    dndTimes = [
        {id: 'thirty_minutes', label: t('status_dropdown.dnd_sub_menu_item.thirty_minutes'), labelDefault: '30 mins'},
        {id: 'one_hour', label: t('status_dropdown.dnd_sub_menu_item.one_hour'), labelDefault: '1 hour'},
        {id: 'two_hours', label: t('status_dropdown.dnd_sub_menu_item.two_hours'), labelDefault: '2 hours'},
        {id: 'tomorrow', label: t('status_dropdown.dnd_sub_menu_item.tomorrow'), labelDefault: 'Tomorrow'},
        {id: 'custom', label: t('status_dropdown.dnd_sub_menu_item.custom'), labelDefault: 'Custom'},
    ];
    static defaultProps = {
        userId: '',
        profilePicture: '',
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            openUp: false,
            width: 0,
            isStatusSet: false,
        };
    }

    openProfileModal = (): void => {
        this.props.actions.openModal({
            modalId: ModalIdentifiers.USER_SETTINGS,
            dialogType: UserSettingsModal,
            dialogProps: {isContentProductSettings: false},
        });
    };

    setStatus = (status: string, dndEndTime?: number): void => {
        this.props.actions.setStatus({
            user_id: this.props.userId,
            status,
            dnd_end_time: dndEndTime,
        });
    };

    isUserOutOfOffice = (): boolean => {
        return this.props.status === UserStatuses.OUT_OF_OFFICE;
    };

    setOnline = (event: Event): void => {
        event.preventDefault();
        this.setStatus(UserStatuses.ONLINE);
    };

    setOffline = (event: Event): void => {
        event.preventDefault();
        this.setStatus(UserStatuses.OFFLINE);
    };

    setAway = (event: Event): void => {
        event.preventDefault();
        this.setStatus(UserStatuses.AWAY);
    };

    setDnd = (index: number): void => {
        const currentDate = getCurrentMomentForTimezone(this.props.timezone);
        let endTime = currentDate;
        switch (index) {
        case 0:
            // add 30 minutes in current time
            endTime = currentDate.add(30, 'minutes');
            break;
        case 1:
            // add 1 hour in current time
            endTime = currentDate.add(1, 'hour');
            break;
        case 2:
            // add 2 hours in current time
            endTime = currentDate.add(2, 'hours');
            break;
        case 3:
            // add one day in current date
            endTime = currentDate.add(1, 'day');
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

    renderProfilePicture = (size: TAvatarSizeToken): ReactNode => {
        if (!this.props.profilePicture) {
            return null;
        }
        return (
            <Avatar
                size={size}
                url={this.props.profilePicture}
                tabIndex={undefined}
            />
        );
    };

    handleClearStatus = (e: React.MouseEvent<HTMLButtonElement> | React.MouseEvent<HTMLDivElement> | React.TouchEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        this.props.actions.unsetCustomStatus();
    };

    handleEmitUserLoggedOutEvent = (): void => {
        GlobalActions.emitUserLoggedOutEvent();
    };

    onToggle = (open: boolean): void => {
        this.props.actions.setStatusDropdown(open);
    };

    handleCompleteYourProfileTask = (): void => {
        const taskName = OnboardingTasksName.COMPLETE_YOUR_PROFILE;
        const steps = TaskNameMapToSteps[taskName];
        const currentUserId = this.props.currentUser.id;
        const preferences = [
            {
                user_id: currentUserId,
                category: OnboardingTaskCategory,
                name: taskName,
                value: steps.FINISHED.toString(),
            },
        ];
        this.props.actions.savePreferences(currentUserId, preferences);
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
            customStatusHelpText = localizeMessage('status_dropdown.set_custom_text', 'Set Custom Status Text...');
            break;
        case isStatusSet && !customStatus?.text && customStatus?.duration !== CustomStatusDuration.DONT_CLEAR:
            customStatusText = '';
            break;
        case !isStatusSet:
            customStatusHelpText = localizeMessage('status_dropdown.set_custom', 'Set a Custom Status');
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

        const clearableTooltip = (
            <Tooltip id={'InputClearTooltip'}>
                <FormattedMessage
                    id={'input.clear'}
                    defaultMessage='Clear'
                />
            </Tooltip>
        );

        const clearButton = isStatusSet && !pulsatingDot && (
            <div
                className={classNames('status-dropdown-menu__clear-container', 'input-clear visible')}
                onClick={this.handleClearStatus}
                onTouchEnd={this.handleClearStatus}
            >
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement={'left'}
                    overlay={clearableTooltip}
                >
                    <span
                        className='input-clear-x'
                        aria-hidden='true'
                    >
                        <i className='icon icon-close-circle'/>
                    </span>
                </OverlayTrigger>
            </div>
        );

        const expiryTime = isStatusSet && customStatus?.expires_at && customStatus.duration !== CustomStatusDuration.DONT_CLEAR &&
            (
                <ExpiryTime
                    time={customStatus.expires_at}
                    timezone={this.props.timezone}
                    className={classNames('custom_status__expiry', {
                        padded: customStatus?.text.length > 0,
                    })}
                    withinBrackets={true}
                />
            );

        return (
            <Menu.Group>
                <Menu.ItemToggleModalRedux
                    ariaLabel={customStatusText || customStatusHelpText}
                    modalId={ModalIdentifiers.CUSTOM_STATUS}
                    dialogType={CustomStatusModal}
                    className={classNames('MenuItem__primary-text custom_status__row', {
                        flex: customStatus?.text.length === 0,
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
                            color='disabled'
                        >
                            {customStatusHelpText}
                        </Text>
                        {clearButton}
                        {pulsatingDot}
                    </span>
                    {expiryTime}
                </Menu.ItemToggleModalRedux>
            </Menu.Group>
        );
    };

    render = (): JSX.Element => {
        const {intl} = this.props;
        const needsConfirm = this.isUserOutOfOffice() && this.props.autoResetPref === '';
        const {status, customStatus, isCustomStatusExpired, currentUser} = this.props;
        const isStatusSet = customStatus && (customStatus.text.length > 0 || customStatus.emoji.length > 0) && !isCustomStatusExpired;

        const setOnline = needsConfirm ? () => this.showStatusChangeConfirmation('online') : this.setOnline;
        const setDnd = needsConfirm ? () => this.showStatusChangeConfirmation('dnd') : this.setDnd;
        const setAway = needsConfirm ? () => this.showStatusChangeConfirmation('away') : this.setAway;
        const setOffline = needsConfirm ? () => this.showStatusChangeConfirmation('offline') : this.setOffline;
        const setCustomTimedDnd = needsConfirm ? () => this.showStatusChangeConfirmation('dnd') : this.setCustomTimedDnd;

        const selectedIndicator = (
            <CheckIcon
                size={16}
                color={'var(--semantic-color-success)'}
            />
        );

        const dndSubMenuItems = [
            {
                id: 'dndSubMenu-header',
                direction: 'right',
                text: localizeMessage('status_dropdown.dnd_sub_menu_header', 'Disable notifications until:'),
                isHeader: true,
            } as any,
        ].concat(
            this.dndTimes.map(({id, label, labelDefault}, index) => {
                let text: React.ReactNode = localizeMessage(label, labelDefault);
                if (index === 3) {
                    const tomorrow = getCurrentMomentForTimezone(this.props.timezone).add(1, 'day').toDate();
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
                        index === 4 ? () => setCustomTimedDnd() : () => setDnd(index),
                } as any;
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
                    {this.renderProfilePicture('sm')}
                    <div
                        className='status'
                    >
                        <StatusIcon
                            size={'sm'}
                            status={(this.props.status || 'offline') as TUserStatus}
                        />
                    </div>
                </button>
                <Menu
                    ariaLabel={localizeMessage('status_dropdown.menuAriaLabel', 'Set a status')}
                    id={'statusDropdownMenu'}
                    listId={'status-drop-down-menu-list'}
                >
                    {currentUser && (
                        <Menu.Header onClick={this.openProfileModal}>
                            {this.renderProfilePicture('lg')}
                            <div className={'username-wrapper'}>
                                <Text
                                    className={'bold'}
                                    margin={'none'}
                                >{`${currentUser.first_name} ${currentUser.last_name}`}</Text>
                                <Text
                                    margin={'none'}
                                    className={!currentUser.first_name && !currentUser.last_name ? 'bold' : ''}
                                    color={!currentUser.first_name && !currentUser.last_name ? undefined : 'disabled'}
                                >
                                    {'@' + currentUser.username}
                                </Text>
                            </div>
                        </Menu.Header>
                    )}
                    <Menu.Group>
                        <Menu.ItemAction
                            show={this.isUserOutOfOffice()}
                            onClick={() => null}
                            ariaLabel={localizeMessage('status_dropdown.set_ooo', 'Out of office').toLowerCase()}
                            text={localizeMessage('status_dropdown.set_ooo', 'Out of office')}
                            extraText={localizeMessage('status_dropdown.set_ooo.extra', 'Automatic Replies are enabled')}
                        />
                    </Menu.Group>
                    {customStatusComponent}
                    <Menu.Group>
                        <Menu.ItemAction
                            onClick={setOnline}
                            ariaLabel={localizeMessage('status_dropdown.set_online', 'Online').toLowerCase()}
                            text={localizeMessage('status_dropdown.set_online', 'Online')}
                            icon={(
                                <StatusIcon
                                    status={'online'}
                                    className={'status-icon'}
                                />
                            )}
                            rightDecorator={status === 'online' && selectedIndicator}
                            id={'status-menu-online'}
                        />
                        <Menu.ItemAction
                            onClick={setAway}
                            ariaLabel={localizeMessage('status_dropdown.set_away', 'Away').toLowerCase()}
                            text={localizeMessage('status_dropdown.set_away', 'Away')}
                            icon={(
                                <StatusIcon
                                    status={'away'}
                                    className={'status-icon'}
                                />
                            )}
                            rightDecorator={status === 'away' && selectedIndicator}
                            id={'status-menu-away'}
                        />
                        <Menu.ItemSubMenu
                            subMenu={dndSubMenuItems}
                            ariaLabel={`${localizeMessage('status_dropdown.set_dnd', 'Do not disturb').toLowerCase()}. ${localizeMessage('status_dropdown.set_dnd.extra', 'Disables desktop, email and push notifications').toLowerCase()}`}
                            text={localizeMessage('status_dropdown.set_dnd', 'Do not disturb')}
                            extraText={localizeMessage('status_dropdown.set_dnd.extra', 'Disables all notifications')}
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
                        />
                        <Menu.ItemAction
                            onClick={setOffline}
                            ariaLabel={localizeMessage('status_dropdown.set_offline', 'Offline').toLowerCase()}
                            text={localizeMessage('status_dropdown.set_offline', 'Offline')}
                            icon={(
                                <StatusIcon
                                    status={'offline'}
                                    className={'status-icon'}
                                />
                            )}
                            rightDecorator={status === 'offline' && selectedIndicator}
                            id={'status-menu-offline'}
                        />
                    </Menu.Group>
                    <Menu.Group>
                        <Menu.ItemToggleModalRedux
                            id='accountSettings'
                            ariaLabel='Profile'
                            modalId={ModalIdentifiers.USER_SETTINGS}
                            dialogType={UserSettingsModal}
                            dialogProps={{isContentProductSettings: false}}
                            text={localizeMessage('navbar_dropdown.profileSettings', 'Profile')}
                            icon={<AccountOutlineIcon size={16}/>}
                        >
                            {this.props.showCompleteYourProfileTour && (
                                <div
                                    onClick={this.handleCompleteYourProfileTask}
                                    className={'account-settings-complete'}
                                >
                                    <CompleteYourProfileTour/>
                                </div>
                            )}
                        </Menu.ItemToggleModalRedux>
                    </Menu.Group>
                    <Menu.Group>
                        <Menu.ItemAction
                            id='logout'
                            onClick={this.handleEmitUserLoggedOutEvent}
                            text={localizeMessage('navbar_dropdown.logout', 'Log Out')}
                            icon={<ExitToAppIcon size={16}/>}
                        />
                    </Menu.Group>
                </Menu>
            </MenuWrapper>
        );
    };
}
export default injectIntl(StatusDropdown);
