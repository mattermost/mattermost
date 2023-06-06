// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';
import classNames from 'classnames';

import {AccountOutlineIcon, AccountPlusOutlineIcon, CloseIcon, EmoticonHappyOutlineIcon, PhoneInTalkIcon, SendIcon} from '@mattermost/compass-icons/components';

import Pluggable from 'plugins/pluggable';

import {displayUsername, isGuest, isSystemAdmin} from 'mattermost-redux/utils/user_utils';
import {Client4} from 'mattermost-redux/client';

import * as GlobalActions from 'actions/global_actions';

import {Channel} from '@mattermost/types/channels';
import {ModalData} from 'types/actions';

import {getHistory} from 'utils/browser_history';
import Constants, {A11yClassNames, A11yCustomEventTypes, A11yFocusEventDetail, ModalIdentifiers, UserStatuses} from 'utils/constants';
import {t} from 'utils/i18n';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';
import {shouldFocusMainTextbox} from 'utils/post_utils';

import {ProfileTimezone} from './profile_localtime';

import StatusIcon from 'components/status_icon';
import Timestamp from 'components/timestamp';
import UserSettingsModal from 'components/user_settings/modal';
import AddUserToChannelModal from 'components/add_user_to_channel_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import Avatar from 'components/widgets/users/avatar';
import Popover from 'components/widgets/popover';
import SharedUserIndicator from 'components/shared_user_indicator';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusModal from 'components/custom_status/custom_status_modal';
import CustomStatusText from 'components/custom_status/custom_status_text';
import ExpiryTime from 'components/custom_status/expiry_time';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import ProfilePopoverCallButton from 'components/profile_popover_call_button';

import {ServerError} from '@mattermost/types/errors';
import {UserCustomStatus, UserProfile, CustomStatusDuration} from '@mattermost/types/users';

import './profile_popover.scss';
import BotTag from '../widgets/tag/bot_tag';
import GuestTag from '../widgets/tag/guest_tag';
import Tag from '../widgets/tag/tag';

interface ProfilePopoverProps extends Omit<React.ComponentProps<typeof Popover>, 'id'> {

    /**
     * Source URL from the image to display in the popover
     */
    src: string;

    /**
     * Source URL from the image that should override default image
     */
    overwriteIcon?: string;

    /**
     * Set to true of the popover was opened from a webhook post
     */
    fromWebhook?: boolean;

    /**
     * User the popover is being opened for
     */
    user?: UserProfile;
    userId: string;
    channelId?: string;

    /**
     * Status for the user, either 'offline', 'away', 'dnd' or 'online'
     */
    status?: string;
    hideStatus?: boolean;

    /**
     * Function to call to hide the popover
     */
    hide?: () => void;

    /**
     * Function to call to return focus to the previously focused element when the popover closes.
     * If not provided, the popover will automatically determine the previously focused element
     * and focus that on close. However, if the previously focused element is not correctly detected
     * by the popover, or the previously focused element will disappear after the popover opens,
     * it is necessary to provide this function to focus the correct element.
     */
    returnFocus?: () => void;

    /**
     * Set to true if the popover was opened from the right-hand
     * sidebar (comment thread, search results, etc.)
     */
    isRHS?: boolean;
    isBusy?: boolean;
    isMobileView: boolean;

    /**
     * Returns state of modals in redux for determing which need to be closed
     */
    modals?: {
        modalState: {
            [modalId: string]: {
                open: boolean;
                dialogProps: Record<string, any>;
                dialogType: React.ComponentType;
            };
        };
    };
    currentTeamId: string;

    /**
     * @internal
     */
    currentUserId: string;
    customStatus?: UserCustomStatus | null;
    isCustomStatusEnabled: boolean;
    isCustomStatusExpired: boolean;
    currentUserTimezone?: string;

    /**
     * @internal
     */
    hasMention?: boolean;

    /**
     * @internal
     */
    isInCurrentTeam: boolean;

    /**
     * @internal
     */
    teamUrl: string;

    /**
     * @internal
     */
    isTeamAdmin: boolean;

    /**
     * @internal
     */
    isChannelAdmin: boolean;

    /**
     * @internal
     */
    canManageAnyChannelMembersInCurrentTeam: boolean;

    /**
     * @internal
     */
    teammateNameDisplay: string;

    /**
     * The overwritten username that should be shown at the top of the popover
     */
    overwriteName?: React.ReactNode;

    /**
     * @internal
     */
    enableTimezone: boolean;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        closeModal: (modalId: string) => void;
        openDirectChannelToUserId: (userId?: string) => Promise<{error: ServerError}>;
        getMembershipForEntities: (teamId: string, userId: string, channelId?: string) => Promise<void>;
    };
    intl: IntlShape;
    lastActivityTimestamp: number;
    enableLastActiveTime: boolean;
    timestampUnits: string[];
    isCallsEnabled: boolean;
    isUserInCall?: boolean;
    isCurrentUserInCall?: boolean;
    isCallsDefaultEnabledOnAllChannels?: boolean;
    isCallsCanBeDisabledOnSpecificChannels?: boolean;
    dMChannel?: Channel | null;
    isAnyModalOpen: boolean;
}
type ProfilePopoverState = {
    loadingDMChannel?: string;
    callsChannelState?: ChannelCallsState;
    callsDMChannelState?: ChannelCallsState;
};

type ChannelCallsState = {
    enabled: boolean;
    id: string;
};

/**
 * The profile popover, or hovercard, that appears with user information when clicking
 * on the username or profile picture of a user.
 */

class ProfilePopover extends React.PureComponent<ProfilePopoverProps, ProfilePopoverState> {
    closeButtonRef: React.RefObject<HTMLButtonElement>;
    returnFocus: () => void;

    static getComponentName() {
        return 'ProfilePopover';
    }
    static defaultProps = {
        isRHS: false,
        hasMention: false,
        status: UserStatuses.OFFLINE,
        customStatus: null,
    };
    constructor(props: ProfilePopoverProps) {
        super(props);
        this.state = {
            loadingDMChannel: undefined,
        };
        this.closeButtonRef = React.createRef();

        if (this.props.returnFocus) {
            this.returnFocus = this.props.returnFocus;
        } else {
            const previouslyFocused = document.activeElement;
            this.returnFocus = () => {
                document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
                    A11yCustomEventTypes.FOCUS, {
                        detail: {
                            target: previouslyFocused as HTMLElement,
                            keyboardOnly: true,
                        },
                    },
                ));
            };
        }
    }
    componentDidMount() {
        const {currentTeamId, userId, channelId} = this.props;
        if (currentTeamId && userId) {
            this.props.actions.getMembershipForEntities(
                currentTeamId,
                userId,
                channelId,
            );
        }
        if (this.props.isCallsEnabled && this.props.dMChannel) {
            this.getCallsChannelState(this.props.dMChannel.id).then((data) => {
                this.setState({callsDMChannelState: data});
            });
        }

        if (this.props.isCallsEnabled && this.props.channelId) {
            this.getCallsChannelState(this.props.channelId).then((data) => {
                this.setState({callsChannelState: data});
            });
        }

        // Focus the close button when the popover first opens, to bring the focus into the popover.
        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: this.closeButtonRef.current,
                    keyboardOnly: true,
                },
            },
        ));
    }

    componentDidUpdate(prevProps: ProfilePopoverProps) {
        if (this.props.isAnyModalOpen !== prevProps.isAnyModalOpen) {
            this.props.hide?.();
        }
    }

    handleShowDirectChannel = (e: React.MouseEvent<HTMLButtonElement>) => {
        const {actions} = this.props;
        e.preventDefault();
        if (!this.props.user) {
            return;
        }
        const user = this.props.user;
        if (this.state.loadingDMChannel !== undefined) {
            return;
        }
        this.setState({loadingDMChannel: user.id});
        actions.openDirectChannelToUserId(user.id).then((result: {error: ServerError}) => {
            if (!result.error) {
                if (this.props.isMobileView) {
                    GlobalActions.emitCloseRightHandSide();
                }
                this.setState({loadingDMChannel: undefined});
                this.props.hide?.();
                getHistory().push(`${this.props.teamUrl}/messages/@${user.username}`);
            }
        });
        this.handleCloseModals();
    };
    handleEditAccountSettings = () => {
        if (!this.props.user) {
            return;
        }
        this.props.hide?.();
        this.props.actions.openModal({
            modalId: ModalIdentifiers.USER_SETTINGS,
            dialogType: UserSettingsModal,
            dialogProps: {isContentProductSettings: false, onExited: this.returnFocus},
        });
        this.handleCloseModals();
    };
    showCustomStatusModal = () => {
        this.props.hide?.();
        const customStatusInputModalData = {
            modalId: ModalIdentifiers.CUSTOM_STATUS,
            dialogType: CustomStatusModal,
            dialogProps: {onExited: this.returnFocus},
        };
        this.props.actions.openModal(customStatusInputModalData);
    };
    handleAddToChannel = () => {
        this.props.hide?.();
        this.handleCloseModals();
    };
    handleCloseModals = () => {
        const {modals} = this.props;
        for (const modal in modals?.modalState) {
            if (!Object.prototype.hasOwnProperty.call(modals, modal)) {
                continue;
            }
            if (modals?.modalState[modal].open) {
                this.props.actions.closeModal(modal);
            }
        }
    };
    handleKeyDown = (e: React.KeyboardEvent) => {
        if (shouldFocusMainTextbox(e, document.activeElement)) {
            this.props.hide?.();
        } else if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ESCAPE)) {
            this.returnFocus();
        }
    };
    renderCustomStatus() {
        const {
            customStatus,
            isCustomStatusEnabled,
            user,
            currentUserId,
            hideStatus,
            isCustomStatusExpired,
        } = this.props;
        const customStatusSet = (customStatus?.text || customStatus?.emoji) && !isCustomStatusExpired;
        const canSetCustomStatus = user?.id === currentUserId;
        const shouldShowCustomStatus =
            isCustomStatusEnabled &&
            !hideStatus &&
            (customStatusSet || canSetCustomStatus);
        if (!shouldShowCustomStatus) {
            return null;
        }
        let customStatusContent;
        let expiryContent;
        if (customStatusSet) {
            const customStatusEmoji = (
                <CustomStatusEmoji
                    userID={this.props.user?.id}
                    showTooltip={false}
                    emojiStyle={{
                        marginRight: 4,
                        marginTop: 1,
                    }}
                />
            );
            customStatusContent = (
                <div className='d-flex align-items-center'>
                    {customStatusEmoji}
                    <CustomStatusText
                        tooltipDirection='top'
                        text={customStatus?.text || ''}
                        className='user-popover__email'
                    />
                </div>
            );

            expiryContent = customStatusSet && customStatus?.expires_at && customStatus.duration !== CustomStatusDuration.DONT_CLEAR && (
                <ExpiryTime
                    time={customStatus.expires_at}
                    timezone={this.props.currentUserTimezone}
                    className='ml-1'
                    withinBrackets={true}
                />
            );
        } else if (canSetCustomStatus) {
            customStatusContent = (
                <button
                    className='user-popover__set-custom-status-btn'
                    onClick={this.showCustomStatusModal}
                >
                    <EmoticonHappyOutlineIcon size={14}/>
                    <FormattedMessage
                        id='user_profile.custom_status.set_status'
                        defaultMessage='Set a status'
                    />
                </button>
            );
        }

        return {customStatusContent, expiryContent};
    }
    handleClose = () => {
        this.props.hide?.();
        this.returnFocus();
    };
    getCallsChannelState(channelId: string): Promise<ChannelCallsState> {
        let data: Promise<ChannelCallsState>;
        try {
            data = Client4.getCallsChannelState(channelId);
        } catch (error) {
            return error;
        }

        return data;
    }
    render() {
        if (!this.props.user) {
            return null;
        }

        const keysToBeRemoved: Array<keyof ProfilePopoverProps> = ['user', 'userId', 'channelId', 'src', 'status', 'hideStatus', 'isBusy',
            'hide', 'isRHS', 'hasMention', 'enableTimezone', 'currentUserId', 'currentTeamId', 'teamUrl', 'actions', 'isTeamAdmin',
            'isChannelAdmin', 'canManageAnyChannelMembersInCurrentTeam', 'intl'];
        const popoverProps: React.ComponentProps<typeof Popover> = Utils.deleteKeysFromObject({...this.props},
            keysToBeRemoved);
        const {formatMessage} = this.props.intl;
        const dataContent = [];
        const urlSrc = this.props.overwriteIcon ? this.props.overwriteIcon : this.props.src;
        dataContent.push(
            <div
                className='user-popover-image'
                key='user-popover-image'
            >
                <Avatar
                    id='userAvatar'
                    size='xxl'
                    username={this.props.user?.username || ''}
                    url={urlSrc}
                    tabIndex={-1}
                />
                <StatusIcon
                    className='status user-popover-status'
                    status={this.props.hideStatus ? undefined : this.props.status}
                    button={true}
                />
            </div>,
        );
        if (this.props.enableLastActiveTime && this.props.lastActivityTimestamp && this.props.timestampUnits) {
            dataContent.push(
                <div
                    className='user-popover-last-active'
                    key='user-popover-last-active'
                >
                    <FormattedMessage
                        id='channel_header.lastOnline'
                        defaultMessage='Last online {timestamp}'
                        values={{
                            timestamp: (
                                <Timestamp
                                    value={this.props.lastActivityTimestamp}
                                    units={this.props.timestampUnits}
                                    useTime={false}
                                    style={'short'}
                                />
                            ),
                        }}
                    />
                </div>,
            );
        }

        const fullname = this.props.overwriteName ? this.props.overwriteName : Utils.getFullName(this.props.user);
        const haveOverrideProp = this.props.overwriteIcon || this.props.overwriteName;
        if (fullname) {
            let sharedIcon;
            if (this.props.user.remote_id) {
                sharedIcon = (
                    <SharedUserIndicator
                        className='shared-user-icon'
                        withTooltip={true}
                    />
                );
            }
            dataContent.push(
                <div
                    data-testid={`popover-fullname-${this.props.user.username}`}
                    className='overflow--ellipsis pb-1'
                    key='user-popover-fullname'
                >
                    <span className='user-profile-popover__heading'>{fullname}</span>
                    {sharedIcon}
                </div>,
            );
        }
        if (this.props.user.is_bot && !haveOverrideProp) {
            dataContent.push(
                <div
                    key='bot-description'
                    className='overflow--ellipsis text-nowrap pb-1'
                >
                    {this.props.user.bot_description}
                </div>,
            );
        }
        const userNameClass = classNames('overflow--ellipsis pb-1', {'user-profile-popover__heading': fullname === ''});
        const userName: React.ReactNode = `@${this.props.user.username}`;
        dataContent.push(
            <div
                id='userPopoverUsername'
                className={userNameClass}
                key='user-popover-username'
            >
                {userName}
            </div>,
        );
        if (this.props.user.position && !haveOverrideProp) {
            const position = (this.props.user?.position || '').substring(
                0,
                Constants.MAX_POSITION_LENGTH,
            );
            dataContent.push(
                <div
                    className='overflow--ellipsis text-nowrap'
                    key='user-popover-position'
                >
                    {position}
                </div>,
            );
        }
        dataContent.push(
            <hr
                key='user-popover-hr'
                className='divider divider--expanded'
            />,
        );
        const email = this.props.user.email || '';
        if (email && !this.props.user.is_bot && !haveOverrideProp) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    title={email}
                    key='user-popover-email'
                >
                    <a
                        href={'mailto:' + email}
                        className='text-nowrap text-lowercase user-popover__email pb-1'
                    >
                        {email}
                    </a>
                </div>,
            );
        }
        dataContent.push(
            <Pluggable
                key='profilePopoverPluggable2'
                pluggableName='PopoverUserAttributes'
                user={this.props.user}
                hide={this.props.hide}
                status={this.props.hideStatus ? null : this.props.status}
                fromWebhook={this.props.fromWebhook}
            />,
        );
        if (
            this.props.enableTimezone &&
            this.props.user.timezone &&
            !haveOverrideProp
        ) {
            dataContent.push(
                <ProfileTimezone
                    currentUserTimezone={this.props.currentUserTimezone}
                    profileUserTimezone={this.props.user.timezone}
                    key='user-popover-local-time'
                />,
            );
        }

        const customStatusAndExpiryContent = !haveOverrideProp && this.renderCustomStatus();
        if (customStatusAndExpiryContent) {
            const {customStatusContent, expiryContent} = customStatusAndExpiryContent;
            dataContent.push(
                <div
                    key='user-popover-status'
                    id='user-popover-status'
                    className='user-popover__time-status-container'
                >
                    <span className='user-popover__subtitle'>
                        <FormattedMessage
                            id='user_profile.custom_status'
                            defaultMessage='Status'
                        />
                        {expiryContent}
                    </span>
                    {customStatusContent}
                </div>,
            );
        }
        const sendMessageTooltip = (
            <Tooltip id='sendMessageTooltip'>
                <FormattedMessage
                    id='user_profile.send.dm.yourself'
                    defaultMessage='Send yourself a message'
                />
            </Tooltip>
        );
        if (this.props.user.id === this.props.currentUserId && !haveOverrideProp) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    key='user-popover-settings'
                    className='popover__row first'
                >
                    <button
                        id='editProfileButton'
                        type='button'
                        className='btn'
                        onClick={this.handleEditAccountSettings}
                    >
                        <AccountOutlineIcon
                            size={16}
                            aria-label={formatMessage({
                                id: t('generic_icons.edit'),
                                defaultMessage: 'Edit Icon',
                            })}
                        />
                        <FormattedMessage
                            id='user_profile.account.editProfile'
                            defaultMessage='Edit Profile'
                        />
                    </button>
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='top'
                        overlay={sendMessageTooltip}
                    >
                        <button
                            type='button'
                            className='btn icon-btn'
                            onClick={this.handleShowDirectChannel}
                        >
                            <SendIcon
                                size={18}
                                aria-label={formatMessage({
                                    id: t('user_profile.send.dm.icon'),
                                    defaultMessage: 'Send Message Icon',
                                })}
                            />
                        </button>
                    </OverlayTrigger>
                </div>,
            );
        }
        if (haveOverrideProp) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    key='user-popover-settings'
                    className='popover__row first'
                >
                    <FormattedMessage
                        id='user_profile.account.post_was_created'
                        defaultMessage='This post was created by an integration from'
                    />
                    {` @${this.props.user.username}`}
                </div>,
            );
        }
        const addToChannelMessage = formatMessage({
            id: 'user_profile.add_user_to_channel',
            defaultMessage: 'Add to a Channel',
        });

        const addToChannelButton = (
            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={
                    <Tooltip id='addToChannelTooltip'>
                        {addToChannelMessage}
                    </Tooltip>
                }
            >
                <div>
                    <ToggleModalButton
                        id='addToChannelButton'
                        className='btn icon-btn'
                        ariaLabel={addToChannelMessage}
                        modalId={ModalIdentifiers.ADD_USER_TO_CHANNEL}
                        dialogType={AddUserToChannelModal}
                        dialogProps={{user: this.props.user, onExited: this.returnFocus}}
                        onClick={this.handleAddToChannel}
                    >
                        <AccountPlusOutlineIcon
                            size={18}
                            aria-label={formatMessage({
                                id: t('user_profile.add_user_to_channel.icon'),
                                defaultMessage: 'Add User to Channel Icon',
                            })}
                        />
                    </ToggleModalButton>
                </div>
            </OverlayTrigger>
        );

        const renderCallButton = () => {
            const {isCallsEnabled, isCallsDefaultEnabledOnAllChannels, isCallsCanBeDisabledOnSpecificChannels, dMChannel} = this.props;
            if (
                !isCallsEnabled ||
                this.state.callsDMChannelState?.enabled === false ||
                (!isCallsDefaultEnabledOnAllChannels && !isCallsCanBeDisabledOnSpecificChannels && this.state.callsChannelState?.enabled === false)
            ) {
                return null;
            }

            const disabled = this.props.isUserInCall || this.props.isCurrentUserInCall;
            const startCallMessage = this.props.isUserInCall ? formatMessage({
                id: t('user_profile.call.userBusy'),
                defaultMessage: '{user} is in another call',
            }, {user: fullname === '' ? this.props.user?.username : fullname},
            ) : formatMessage({
                id: t('webapp.mattermost.feature.start_call'),
                defaultMessage: 'Start Call',
            });
            const iconButtonClassname = classNames('btn icon-btn', {'icon-btn-disabled': disabled});
            const callButton = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={
                        <Tooltip id='startCallTooltip'>
                            {startCallMessage}
                        </Tooltip>
                    }
                >
                    <button
                        id='startCallButton'
                        type='button'
                        aria-disabled={disabled}
                        className={iconButtonClassname}
                    >
                        <PhoneInTalkIcon
                            size={18}
                            aria-label={startCallMessage}
                        />
                    </button>
                </OverlayTrigger>
            );

            if (disabled) {
                return callButton;
            }

            return (
                <ProfilePopoverCallButton
                    dmChannel={dMChannel}
                    userId={this.props.userId}
                    customButton={callButton}
                />
            );
        };

        if (this.props.user.id !== this.props.currentUserId && !haveOverrideProp) {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    key='user-popover-dm'
                    className='popover__row first'
                >
                    <button
                        id='messageButton'
                        type='button'
                        className='btn'
                        onClick={this.handleShowDirectChannel}
                    >
                        <SendIcon
                            size={16}
                            aria-label={formatMessage({
                                id: t('user_profile.send.dm.icon'),
                                defaultMessage: 'Send Message Icon',
                            })}
                        />
                        <FormattedMessage
                            id='user_profile.send.dm'
                            defaultMessage='Message'
                        />
                    </button>
                    <div className='popover_row-controlContainer'>
                        {(this.props.canManageAnyChannelMembersInCurrentTeam && this.props.isInCurrentTeam) ? addToChannelButton : null}
                        {renderCallButton()}
                    </div>
                </div>,
            );
        }
        dataContent.push(
            <Pluggable
                key='profilePopoverPluggable3'
                pluggableName='PopoverUserActions'
                user={this.props.user}
                hide={this.props.hide}
                status={this.props.hideStatus ? null : this.props.status}
            />,
        );
        let roleTitle;
        if (this.props.user.is_bot) {
            roleTitle = (
                <BotTag
                    className='user-popover__role'
                    size={'sm'}
                />
            );
        } else if (isGuest(this.props.user.roles)) {
            roleTitle = (
                <GuestTag
                    className='user-popover__role'
                    size={'sm'}
                />
            );
        } else if (isSystemAdmin(this.props.user.roles)) {
            roleTitle = (
                <Tag
                    className='user-popover__role'
                    size={'sm'}
                    text={Utils.localizeMessage(
                        'admin.permissions.roles.system_admin.name',
                        'System Admin',
                    )}
                />
            );
        } else if (this.props.isTeamAdmin) {
            roleTitle = (
                <Tag
                    className='user-popover__role'
                    size={'sm'}
                    text={Utils.localizeMessage(
                        'admin.permissions.roles.team_admin.name',
                        'Team Admin',
                    )}
                />
            );
        } else if (this.props.isChannelAdmin) {
            roleTitle = (
                <Tag
                    className='user-popover__role'
                    size={'sm'}
                    text={Utils.localizeMessage(
                        'admin.permissions.roles.channel_admin.name',
                        'Channel Admin',
                    )}
                />
            );
        }
        const title = (
            <span data-testid={`profilePopoverTitle_${this.props.user.username}`}>
                {roleTitle}
                <button
                    ref={this.closeButtonRef}
                    className='user-popover__close'
                    onClick={this.handleClose}
                >
                    <CloseIcon
                        size={18}
                    />
                </button>
            </span>
        );

        const displayName = displayUsername(this.props.user, this.props.teammateNameDisplay);
        const titleClassName = classNames('popover-title', {'popover-title_height': !roleTitle});

        const tabCatcher = (
            <span
                tabIndex={0}
                onFocus={(e) => (e.relatedTarget as HTMLElement).focus()}
            />
        );

        return (
            <Popover
                {...popoverProps}
                id='user-profile-popover'
            >
                {tabCatcher}
                <div
                    role='dialog'
                    aria-label={formatMessage(
                        {
                            id: 'profile_popover.profileLabel',
                            defaultMessage: 'Profile for {name}',
                        },
                        {
                            name: displayName,
                        },
                    )}
                    onKeyDown={this.handleKeyDown}
                    className={A11yClassNames.POPUP}
                    aria-modal={true}
                >
                    <div className={titleClassName}>
                        {title}
                    </div>
                    <div className='user-profile-popover__content'>
                        {dataContent}
                    </div>
                </div>
                {tabCatcher}
            </Popover>
        );
    }
}

export default injectIntl(ProfilePopover);
