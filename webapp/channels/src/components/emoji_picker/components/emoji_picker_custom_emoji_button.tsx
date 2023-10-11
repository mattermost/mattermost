// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import Permissions from 'mattermost-redux/constants/permissions';

import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

interface Props {
    customEmojisEnabled: boolean;
    currentTeamName: string;
    handleEmojiPickerClose: () => void;
}

function EmojiPickerCustomEmojiButton({customEmojisEnabled, currentTeamName, handleEmojiPickerClose}: Props) {
    if (!customEmojisEnabled) {
        return null;
    }

    if (currentTeamName.length === 0) {
        return null;
    }

    return (
        <AnyTeamPermissionGate permissions={[Permissions.CREATE_EMOJIS]}>
            <div className='emoji-picker__custom'>
                <Link
                    className='btn btn-tertiary'
                    to={`/${currentTeamName}/emoji`}
                    onClick={handleEmojiPickerClose}
                >
                    <FormattedMessage
                        id='emoji_picker.custom_emoji'
                        defaultMessage='Custom Emoji'
                    />
                </Link>
            </div>
        </AnyTeamPermissionGate>
    );
}

export default memo(EmojiPickerCustomEmojiButton);
