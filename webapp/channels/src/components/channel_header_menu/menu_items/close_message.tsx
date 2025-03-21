// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getRedirectChannelNameForCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {leaveDirectChannel} from 'actions/views/channel';

import * as Menu from 'components/menu';

import {getHistory} from 'utils/browser_history';
import {Constants} from 'utils/constants';

type Props = {
    currentUserID: string;
    channel: Channel;
    id?: string;
};

export default function CloseMessage(props: Props) {
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const redirectChannel = useSelector(getRedirectChannelNameForCurrentTeam);

    const handleClose = () => {
        const {
            channel,
            currentUserID,
        } = props;

        let name: string;
        let category;
        if (channel.type === Constants.DM_CHANNEL) {
            category = Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW;
            name = channel.teammate_id!;
        } else {
            category = Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW;
            name = channel.id;
        }

        dispatch(leaveDirectChannel(channel.name));
        dispatch(savePreferences(currentUserID, [{user_id: currentUserID, category, name, value: 'false'}]));

        if (currentTeam) {
            getHistory().push(`/${currentTeam.name}/channels/${redirectChannel}`);
        }
    };

    const {id, channel} = props;

    // DM
    let text = (
        <FormattedMessage
            id='center_panel.direct.closeDirectMessage'
            defaultMessage='Close Direct Message'
        />);
    if (channel.type === Constants.GM_CHANNEL) {
        text = (
            <FormattedMessage
                id='center_panel.direct.closeGroupMessage'
                defaultMessage='Close Group Message'
            />);
    }

    return (
        <Menu.Item
            id={id}
            leadingElement={<CloseIcon size='18px'/>}
            onClick={handleClose}
            labels={text}
        />
    );
}
