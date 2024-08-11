// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import Permissions from 'mattermost-redux/constants/permissions';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

import * as Utils from 'utils/utils';

import EmojiList from './emoji_list';

type Props = {
    teamName?: string;
    teamDisplayName?: string;
    siteName?: string;
    scrollToTop(): void;
    currentTheme: Theme;
    actions: {
        loadRolesIfNeeded(roles: Iterable<string>): void;
    };
}

export default function EmojiPage({teamDisplayName = '', teamName = '', siteName = '', scrollToTop, currentTheme, actions}: Props) {
    useEffect(() => {
        updateTitle();
        actions.loadRolesIfNeeded(['system_admin', 'team_admin', 'system_user', 'team_user']);
        Utils.resetTheme();

        return () => {
            Utils.applyTheme(currentTheme);
        };
    }, [actions, currentTheme]);

    useEffect(() => {
        updateTitle();
    }, [siteName]);

    const updateTitle = () => {
        document.title = Utils.localizeMessage('custom_emoji.header', 'Custom Emoji') + ' - ' + teamDisplayName + ' ' + siteName;
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
                <AnyTeamPermissionGate permissions={[Permissions.CREATE_EMOJIS]}>
                    <Link
                        className='add-link'
                        to={'/' + teamName + '/emoji/add'}
                    >
                        <button
                            type='button'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='emoji_list.add'
                                defaultMessage='Add Custom Emoji'
                            />
                        </button>
                    </Link>
                </AnyTeamPermissionGate>
            </div>
            <EmojiList scrollToTop={scrollToTop}/>
        </div>
    );
}
