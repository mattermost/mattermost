// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import {openModal} from 'actions/views/modals';

import {General} from 'mattermost-redux/constants';

import {leaveChannel} from 'mattermost-redux/actions/channels';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getMyChannelMembership} from 'mattermost-redux/selectors/entities/channels';

import {LeastActiveChannel} from '@mattermost/types/insights';
import {GlobalState} from '@mattermost/types/store';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {copyToClipboard} from 'utils/utils';
import {getSiteURL} from 'utils/url';

import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Menu from 'components/widgets/menu/menu';
import LeaveChannelModal from 'components/leave_channel_modal';

import './channel_actions_menu.scss';

type Props = {
    channel: LeastActiveChannel;
    actionCallback?: () => Promise<void>;
}

const ChannelActionsMenu = ({channel, actionCallback}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);
    const isChannelMember = useSelector((state: GlobalState) => getMyChannelMembership(state, channel.id));
    const isDefault = channel.name === General.DEFAULT_CHANNEL;

    const handleLeave = useCallback(async (e: Event) => {
        e.preventDefault();
        trackEvent('insights', 'leave_channel_action');

        if (channel.type === Constants.PRIVATE_CHANNEL) {
            dispatch(openModal({
                modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
                dialogType: LeaveChannelModal,
                dialogProps: {
                    channel,
                    callback: actionCallback,
                },
            }));
        } else {
            await dispatch(leaveChannel(channel.id));
            actionCallback?.();
        }
    }, [channel]);

    const copyLink = useCallback(() => {
        trackEvent('insights', 'copy_channel_link_action');
        copyToClipboard(`${getSiteURL()}${currentTeamUrl}/channels/${channel.name}`);
    }, [currentTeamUrl, channel]);

    return (
        <div className='channel-action'>
            <MenuWrapper
                isDisabled={false}
                stopPropagationOnToggle={true}
                id={`customWrapper-${channel.id}`}
            >
                <button
                    className='icon action-wrapper'
                    aria-label={formatMessage({id: 'insights.leastActiveChannels.menuButtonAriaLabel', defaultMessage: 'Open manage channel menu'})}
                >
                    <i className='icon icon-dots-vertical'/>
                </button>
                <Menu
                    openLeft={true}
                    openUp={false}
                    className={'group-actions-menu'}
                    ariaLabel={formatMessage({id: 'insights.leastActiveChannels.menuAriaLabel', defaultMessage: 'Manage channel menu'})}
                >
                    <Menu.Group>
                        <Menu.ItemAction
                            onClick={handleLeave}
                            icon={<i className='icon-logout-variant'/>}
                            text={formatMessage({id: 'insights.leastActiveChannels.leaveChannel', defaultMessage: 'Leave channel'})}
                            disabled={false}
                            isDangerous={true}
                            show={Boolean(isChannelMember) && !isDefault}
                        />
                    </Menu.Group>
                    <Menu.Group>
                        <Menu.ItemAction
                            onClick={copyLink}
                            icon={<i className='icon-link-variant'/>}
                            text={formatMessage({id: 'insights.leastActiveChannels.copyLink', defaultMessage: 'Copy link'})}
                            disabled={false}
                        />
                    </Menu.Group>
                </Menu>
            </MenuWrapper>
        </div>
    );
};

export default memo(ChannelActionsMenu);
