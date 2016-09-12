// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import SettingsView from 'components/settings_view.jsx';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';

export default class InviteMembersIndexView extends React.Component {
    static get propTypes() {
        return {
            teamDisplayName: React.PropTypes.string.isRequired,
            teamName: React.PropTypes.string.isRequired,
            closeLink: React.PropTypes.string
        };
    }

    render() {
        return (
            <SettingsView
                title={
                    <FormattedMessage
                        id='invite_users.title'
                        defaultMessage='Invite People to {team}'
                        values={{
                            team: this.props.teamDisplayName
                        }}
                    />
                }
                closeLink={this.props.closeLink}
            >
                <div className='signup-team-all'>
                    <div
                        className='signup-team-dir'
                    >
                        <Link
                            to={'/' + this.props.teamName + '/invite_members/full_members'}
                        >
                            <span className='signup-team-dir__name'>
                                <FormattedMessage
                                    id='invite_users.invite_full_members.title'
                                    defaultMessage='Full Members'
                                />
                            </span>
                            <span
                                className='fa fa-angle-right right signup-team-dir__arrow'
                                aria-hidden='true'
                            />
                        </Link>
                    </div>
                    <div
                        className='signup-team-dir'
                    >
                        <Link
                            to={'/' + this.props.teamName + '/invite_members/single_channel_guest'}
                        >
                            <span className='signup-team-dir__name'>
                                <FormattedMessage
                                    id='invite_users.signle_channel_guest.title'
                                    defaultMessage='Single Channel Guest'
                                />
                            </span>
                            <span
                                className='fa fa-angle-right right signup-team-dir__arrow'
                                aria-hidden='true'
                            />
                        </Link>
                    </div>
                </div>
            </SettingsView>
        );
    }
}
