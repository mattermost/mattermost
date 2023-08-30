// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {GenericModal} from '@mattermost/components';
import {useIntl} from 'react-intl';

import './convert_gm_to_channel_modal.scss';
import WarningTextSection from 'components/convert_gm_to_channel_modal/warning_text_section/warning_text_section';

import ChannelNameFormField from 'components/channel_name_form_field/chanenl_name_form_field';
import {Channel} from '@mattermost/types/channels';
import {Actions} from 'components/convert_gm_to_channel_modal/index';
import {ModalIdentifiers} from 'utils/constants';
import {UserProfile} from '@mattermost/types/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {Team} from '@mattermost/types/teams';
import {Client4} from 'mattermost-redux/client';
import TeamSelector from 'components/convert_gm_to_channel_modal/team_selector/team_selector';
import {trackEvent} from 'actions/telemetry_actions';
import loadingIcon from 'images/spinner-48x48-blue.apng';
import classNames from 'classnames';
import NoCommonTeamsError from 'components/convert_gm_to_channel_modal/no_common_teams/no_common_teams';
import AllMembersDeactivatedError from 'components/convert_gm_to_channel_modal/all_members_deactivated/all_members_deactivated';

export type Props = {
    onExited: () => void;
    channel: Channel;
    actions: Actions;
    profilesInChannel: UserProfile[];
    teammateNameDisplaySetting: string;
    channelsCategoryId: string | undefined;
}

const ConvertGmToChannelModal = (props: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;

    const handleCancel = () => {
        props.actions.closeModal(ModalIdentifiers.CONVERT_GM_TO_CHANNEL);
    };

    const [channelName, setChannelName] = useState<string>('');
    const handleChannelNameChange = (newName: string) => {
        setChannelName(newName);
    };

    const [channelURL, setChannelChannelURL] = useState<string>('');
    const handleChannelURLChange = (newURL: string) => {
        setChannelChannelURL(newURL);
    };

    const channelMemberNames = props.profilesInChannel.map((user) => displayUsername(user, props.teammateNameDisplaySetting));

    const [commonTeamsById, setCommonTeamsById] = useState<{[id: string]: Team}>({});
    const [commonTeamsFetched, setCommonTeamsFetched] = useState<boolean>(false);
    const [loadingAnimationTimeout, setLoadingAnimationTimeout] = useState<boolean>(false);

    const [selectedTeamId, setSelectedTeamId] = useState<string>();
    const handleTeamChange = (teamId: string) => {
        setSelectedTeamId(teamId);
    };

    useEffect(() => {
        const work = async () => {
            const teams = (await Client4.getGroupMessageMembersCommonTeams(props.channel.id)).data;
            const teamsById: {[id: string]: Team} = {};
            teams.forEach((team) => {
                teamsById[team.id] = team;
            });
            setCommonTeamsById(teamsById);
            setCommonTeamsFetched(true);

            // if there is only common team, selected it.
            if (teams.length === 1) {
                setSelectedTeamId(teams[0].id);
            }
        };

        work();
        setTimeout(() => setLoadingAnimationTimeout(true), 2000);
    }, [props.channel.id]);

    const handleConfirm = () => {
        if (!selectedTeamId) {
            return;
        }

        const {actions} = props;
        actions.convertGroupMessageToPrivateChannel(props.channel.id, selectedTeamId, channelName.trim(), channelURL.trim());
        if (props.channelsCategoryId) {
            actions.moveChannelsInSidebar(props.channelsCategoryId, 0, props.channel.id, false);
        }
        trackEvent('actions', 'convert_group_message_to_private_channel', {channel_id: props.channel.id});
        props.actions.closeModal(ModalIdentifiers.CONVERT_GM_TO_CHANNEL);
    };

    const showLoader = () => !commonTeamsFetched || !loadingAnimationTimeout;

    if (props.profilesInChannel.length === 0) {
        return (
            <GenericModal
                id='convert-gm-to-channel-modal'
                className='convert-gm-to-channel-modal'
                modalHeaderText={formatMessage({id: 'sidebar_left.sidebar_channel_modal.header', defaultMessage: 'Convert to Private Channel'})}
                confirmButtonText={formatMessage({id: 'generic.okay', defaultMessage: 'Okay'})}
                compassDesign={true}
                handleConfirm={handleCancel}
                onExited={handleCancel}
            >
                <div className='convert-gm-to-channel-modal-body error'>
                    <AllMembersDeactivatedError/>
                </div>
            </GenericModal>
        );
    } else if (!showLoader() && Object.keys(commonTeamsById).length === 0) {
        return (
            <GenericModal
                id='convert-gm-to-channel-modal'
                className='convert-gm-to-channel-modal'
                modalHeaderText={formatMessage({id: 'sidebar_left.sidebar_channel_modal.header', defaultMessage: 'Convert to Private Channel'})}
                confirmButtonText={formatMessage({id: 'generic.okay', defaultMessage: 'Okay'})}
                compassDesign={true}
                handleConfirm={handleCancel}
                onExited={handleCancel}
            >
                <div className='convert-gm-to-channel-modal-body error'>
                    <NoCommonTeamsError/>
                </div>
            </GenericModal>
        );
    }

    return (
        <GenericModal
            id='convert-gm-to-channel-modal'
            className='convert-gm-to-channel-modal'
            modalHeaderText={formatMessage({id: 'sidebar_left.sidebar_channel_modal.header', defaultMessage: 'Convert to Private Channel'})}
            confirmButtonText={formatMessage({id: 'sidebar_left.sidebar_channel_modal.confirmation_text', defaultMessage: 'Convert to private channel'})}
            cancelButtonText={formatMessage({id: 'channel_modal.cancel', defaultMessage: 'Cancel'})}
            isDeleteModal={true}
            compassDesign={true}
            handleCancel={showLoader() ? undefined : handleCancel}
            handleConfirm={showLoader() ? undefined : handleConfirm}
            onExited={handleCancel}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={selectedTeamId === undefined || channelName === ''}
        >
            <div
                className={classNames({
                    'convert-gm-to-channel-modal-body': true,
                    loading: showLoader(),
                    'single-team': Object.keys(commonTeamsById).length === 1,
                    'multi-team': Object.keys(commonTeamsById).length > 1,
                })}
            >
                {
                    showLoader() &&
                    <div className='loadingIndicator'>
                        <img
                            src={loadingIcon}
                        />
                    </div>
                }

                {
                    !showLoader() &&
                    (
                        <React.Fragment>
                            <WarningTextSection channelMemberNames={channelMemberNames}/>

                            {
                                Object.keys(commonTeamsById).length > 1 &&
                                <TeamSelector
                                    teamsById={commonTeamsById}
                                    onChange={handleTeamChange}
                                />
                            }

                            <ChannelNameFormField
                                value={channelName}
                                name='convert-gm-to-channel-modal-channel-name'
                                placeholder={formatMessage({id: 'sidebar_left.sidebar_channel_modal.channel_name_placeholder', defaultMessage: 'Enter a name for the channel'})}
                                autoFocus={false}
                                onDisplayNameChange={handleChannelNameChange}
                                onURLChange={handleChannelURLChange}
                            />
                        </React.Fragment>
                    )
                }
            </div>
        </GenericModal>
    );
};

export default ConvertGmToChannelModal;
