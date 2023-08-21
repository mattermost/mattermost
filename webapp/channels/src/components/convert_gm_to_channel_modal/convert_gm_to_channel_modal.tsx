// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
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
import AllMembersDeactivated from 'components/convert_gm_to_channel_modal/all_members_deactivated/all_members_deactivated';
import {Team} from '@mattermost/types/teams';
import {Client4} from 'mattermost-redux/client';
import TeamSelector from 'components/convert_gm_to_channel_modal/team_selector/team_selector';
import {trackEvent} from 'actions/telemetry_actions';
import LoadingSpinner from "components/widgets/loading/loading_spinner";
import loadingIcon from "images/spinner-48x48-blue.apng";
import {bool} from "yup";

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

    const handleCancel = useCallback(() => {
        props.actions.closeModal(ModalIdentifiers.CONVERT_GM_TO_CHANNEL);
    }, []);

    const [channelName, setChannelName] = useState<string>('');
    const handleChannelNameChange = useCallback((newName: string) => {
        setChannelName(newName);
    }, []);

    const [channelURL, setChannelChannelURL] = useState<string>('');
    const handleChannelURLChange = (newURL: string) => {
        setChannelChannelURL(newURL);
    };

    const channelMemberNames = props.profilesInChannel.map((user) => displayUsername(user, props.teammateNameDisplaySetting));

    const [commonTeamsById, setCommonTeamsById] = useState<{[id: string]: Team}>({});
    const [selectedTeamId, setSelectedTeamId] = useState<string>();

    const [commonTeamsFetched, setCommonTeamsFetched] = useState<Boolean>(false);
    const [loadingAnimationTimeout, setLoadingAnimationTimeout] = useState<boolean>(false);

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

    const handleTeamChange = (teamId: string) => {
        setSelectedTeamId(teamId);
    };

    const handleConfirm = () => {
        if (!selectedTeamId) {
            return;
        }

        const {actions} = props;
        actions.convertGroupMessageToPrivateChannel(props.channel.id, selectedTeamId, channelName, channelURL);
        if (props.channelsCategoryId) {
            actions.moveChannelsInSidebar(props.channelsCategoryId, 0, props.channel.id, false);
        }
        trackEvent('actions', 'convert_group_message_to_private_channel', {channel_id: props.channel.id});

        props.actions.closeModal(ModalIdentifiers.CONVERT_GM_TO_CHANNEL);
    };

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
                <div className='convert-gm-to-channel-modal-body'>
                    <AllMembersDeactivated/>
                </div>
            </GenericModal>
        );
    } else if (!commonTeamsFetched || !loadingAnimationTimeout) {
        return (
            <GenericModal
                id='convert-gm-to-channel-modal'
                className='convert-gm-to-channel-modal'
                modalHeaderText={formatMessage({id: 'sidebar_left.sidebar_channel_modal.header', defaultMessage: 'Convert to Private Channel'})}
                compassDesign={true}
                onExited={handleCancel}

            >
                <div className='convert-gm-to-channel-modal-body'>
                    <div className='loadingIndicator'>
                        <img
                            src={loadingIcon}
                        />
                    </div>
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
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            onExited={handleCancel}
            autoCloseOnConfirmButton={false}
        >
            <div className='convert-gm-to-channel-modal-body'>
                <WarningTextSection channelMemberNames={channelMemberNames}/>

                {
                    Object.keys(commonTeamsById).length > 0 &&
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
            </div>
        </GenericModal>
    );
};

export default ConvertGmToChannelModal;
