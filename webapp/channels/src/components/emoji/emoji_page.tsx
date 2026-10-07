// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import Permissions from 'mattermost-redux/constants/permissions';

import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

import {getHistory} from 'utils/browser_history';

import EmojiList from './emoji_list';

type Props = {
    teamName?: string;
    teamDisplayName?: string;
    siteName?: string;
    scrollToTop(): void;
    actions: {
        loadRolesIfNeeded(roles: Iterable<string>): void;
    };
};

const CREATE_EMOJIS_PERMISSIONS = [Permissions.CREATE_EMOJIS];
const ROLES = ['system_admin', 'team_admin', 'system_user', 'team_user'];

export default function EmojiPage({
    teamDisplayName = '',
    teamName = '',
    siteName = '',
    scrollToTop,
    actions,
}: Props) {
    const intl = useIntl();

    useEffect(() => {
        updateTitle();
        actions.loadRolesIfNeeded(ROLES);
    }, []);

    useEffect(() => {
        updateTitle();
    }, [siteName]);

    const updateTitle = () => {
        document.title = intl.formatMessage({id: 'custom_emoji.header', defaultMessage: 'Custom Emoji'}) + ' - ' + teamDisplayName + ' ' + siteName;
    };

    return (
        <div className='backstage-content emoji-list'>
            <div className='backstage-header'>
                <h1>
                    <FormattedMessage
                        id='emoji_list.header'
                        defaultMessage='Custom Emoji'
                    />
                </h1>
                <AnyTeamPermissionGate permissions={CREATE_EMOJIS_PERMISSIONS}>
                    <Button
                        type='button'
                        emphasis='primary'
                        onClick={() => getHistory().push('/' + teamName + '/emoji/add')}
                    >
                        <FormattedMessage
                            id='emoji_list.add'
                            defaultMessage='Add Custom Emoji'
                        />
                    </Button>
                </AnyTeamPermissionGate>
            </div>
            <EmojiList scrollToTop={scrollToTop}/>
        </div>
    );
}
