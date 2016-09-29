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
                <div>
                    <div
                        className='invite-type'
                    >
                        <Link
                            to={'/' + this.props.teamName + '/invite_members/full_members'}
                        >
                            <div className='invite-type--left'>
                                <h3 className='invite-type__title'>
                                    <FormattedMessage
                                        id='invite_users.invite_full_members.title'
                                        defaultMessage='Full Members'
                                    />
                                </h3>
                                <h5 className='invite-type__info'>
                                    <FormattedMessage
                                        id='invite_users.invite_full_members.info'
                                        defaultMessage='Full members can access messages and files in any public channel.'
                                    />
                                </h5>
                            </div>
                            <div
                                className='invite-type__icon fa fa-angle-right'
                                aria-hidden='true'
                            />
                        </Link>
                    </div>
                    <div
                        className='invite-type'
                    >
                        <Link
                            to={'/' + this.props.teamName + '/invite_members/single_channel_guest'}
                        >
                            <div className='invite-type--left'>
                                <h3 className='signup-team-dir__name'>
                                    <FormattedMessage
                                        id='invite_users.invite_full_members.title'
                                        defaultMessage='Single Channel Guest'
                                    />
                                </h3>
                                <h5 className='invite-type__info'>
                                    <FormattedMessage
                                        id='invite_users.signle_channel_guest.info'
                                        defaultMessage='Full members can access messages and files in any public channel.'
                                    />
                                </h5>
                            </div>
                            <div
                                className='invite-type__icon fa fa-angle-right'
                                aria-hidden='true'
                            />
                        </Link>
                    </div>
                </div>
            </SettingsView>
        );
    }
}
