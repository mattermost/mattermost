// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import Permissions from 'mattermost-redux/constants/permissions';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import * as Utils from 'utils/utils';
import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

import EmojiList from './emoji_list';

type Props = {
    teamId: string;
    teamName?: string;
    teamDisplayName?: string;
    siteName?: string;
    scrollToTop(): void;
    currentTheme: Theme;
    actions: {
        loadRolesIfNeeded(roles: Iterable<string>): void;
    };
}

export default class EmojiPage extends React.PureComponent<Props> {
    static defaultProps = {
        teamName: '',
        teamDisplayName: '',
        siteName: '',
    }

    componentDidMount() {
        this.updateTitle();
        this.props.actions.loadRolesIfNeeded(['system_admin', 'team_admin', 'system_user', 'team_user']);
        Utils.resetTheme();
    }

    componentWillUnmount() {
        Utils.applyTheme(this.props.currentTheme);
    }

    updateTitle = () => {
        document.title = Utils.localizeMessage('custom_emoji.header', 'Custom Emoji') + ' - ' + this.props.teamDisplayName + ' ' + this.props.siteName;
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.siteName !== prevProps.siteName) {
            this.updateTitle();
        }
    }

    render() {
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
                            to={'/' + this.props.teamName + '/emoji/add'}
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
                <EmojiList scrollToTop={this.props.scrollToTop}/>
            </div>
        );
    }
}
