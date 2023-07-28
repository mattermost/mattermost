// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from "react";
import {GenericModal} from "@mattermost/components";
import {useIntl} from "react-intl";

import './convert_gm_to_channel_modal.scss';
import WarningTextSection from "components/convert_gm_to_channel_modal/warning_text_section/warning_text_section";

import ChannelNameFormField from "components/channel_name_form_field/chanenl_name_form_field";
import {Channel} from "@mattermost/types/channels";
import {Actions} from "components/convert_gm_to_channel_modal/index";
import {ModalIdentifiers} from "utils/constants";
import {UserProfile} from "@mattermost/types/users";
import {displayUsername} from "mattermost-redux/utils/user_utils";
import AllMembersDeactivated from "components/convert_gm_to_channel_modal/all_members_deactivated/all_members_deactivated";
import {Team} from "@mattermost/types/teams";
import {useDispatch} from "react-redux";
import {Client4} from "mattermost-redux/client";
import {common} from "@mui/material/colors";
import TeamSelector from "components/convert_gm_to_channel_modal/team_selector/team_selector";

export type Props = {
    onExited: () => void,
    channel: Channel,
    actions: Actions,
    profilesInChannel: UserProfile[],
    teammateNameDisplaySetting: string,
}

const ConvertGmToChannelModal = (props: Props) => {
    const intl = useIntl()
    const {formatMessage} = intl

    const handleCancel = useCallback(() => {
        props.actions.closeModal(ModalIdentifiers.CONVERT_GM_TO_CHANNEL);
    }, [])

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
        )
    }

    const [channelName, setChannelName] = useState<string>('');

    const handleChannelNameChange = useCallback((newName: string) => {
        setChannelName(newName);
    }, [])

    const channelMemberNames = props.profilesInChannel.map((user) => displayUsername(user, props.teammateNameDisplaySetting));

    const [commonTeams, setCommonTeams] = useState<Team[]>([]);

    useEffect(() => {
        const work = async () => {
            const response = await Client4.getGroupMessageMembersCommonTeams(props.channel.id)
            setCommonTeams(response.data);
        }

        work();
    }, [props.channel.id]);

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
            handleConfirm={() => {}}
            onExited={handleCancel}

        >
            <div className='convert-gm-to-channel-modal-body'>
                <WarningTextSection channelMemberNames={channelMemberNames}/>
                {
                    commonTeams.length > 0 &&
                    <TeamSelector teams={commonTeams} onChange={() => {}}/>
                }
                <ChannelNameFormField
                    value={channelName}
                    name='convert-gm-to-channel-modal-channel-name'
                    placeholder={formatMessage({id: 'sidebar_left.sidebar_channel_modal.channel_name_placeholder', defaultMessage: 'Enter a name for the channel'})}
                    onDisplayNameChange={handleChannelNameChange}
                />
            </div>
        </GenericModal>
    )
}

export default ConvertGmToChannelModal
