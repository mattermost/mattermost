// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {Client4} from 'mattermost-redux/client';

import {ProfilePopoverController} from 'components/profile_popover/profile_popover_controller';
import Avatar from 'components/widgets/users/avatar';

import {useActiveEditors} from 'hooks/useActiveEditors';

import './active_editors_indicator.scss';

type Props = {
    wikiId: string;
    pageId: string;
};

export default function ActiveEditorsIndicator({wikiId, pageId}: Props) {
    const intl = useIntl();
    const editors = useActiveEditors(wikiId, pageId);

    if (editors.length === 0) {
        return null;
    }

    const displayedEditors = editors.slice(0, 3);
    const remainingCount = editors.length - 3;

    return (
        <div className='active-editors-indicator'>
            <div className='active-editors-indicator__avatars'>
                {displayedEditors.map((editor) => (
                    <ProfilePopoverController
                        key={editor.userId}
                        userId={editor.userId}
                        src={Client4.getProfilePictureUrl(editor.userId, editor.user.last_picture_update)}
                        username={editor.user.username}
                        triggerComponentClass='active-editors-indicator__avatar-wrapper'
                    >
                        <Avatar
                            url={Client4.getProfilePictureUrl(editor.userId, editor.user.last_picture_update)}
                            username={editor.user.username}
                            size='sm'
                            className='active-editors-indicator__avatar'
                            data-testid={`active-editor-avatar-${editor.userId}`}
                        />
                    </ProfilePopoverController>
                ))}
                {remainingCount > 0 && (
                    <div className='active-editors-indicator__more'>
                        {`+${remainingCount}`}
                    </div>
                )}
            </div>
            <span className='active-editors-indicator__text'>
                {intl.formatMessage(
                    {
                        id: 'wiki.active_editors.currently_editing',
                        defaultMessage: '{count, plural, one {# person} other {# people}} editing',
                    },
                    {count: editors.length},
                )}
            </span>
        </div>
    );
}
