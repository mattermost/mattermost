// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import SettingsGroup from './settings_group.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import RadioSetting from './radio_setting.jsx';
import PostEditSetting from './post_edit_setting.jsx';
import BooleanSetting from './boolean_setting.jsx';
import TextSetting from './text_setting.jsx';
import ColorSetting from './color_setting.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class PolicySettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ServiceSettings.RestrictPostDelete = this.state.restrictPostDelete;
        config.ServiceSettings.AllowEditPost = this.state.allowEditPost;
        config.ServiceSettings.PostEditTimeLimit = this.parseIntNonZero(this.state.postEditTimeLimit, Constants.DEFAULT_POST_EDIT_TIME_LIMIT);
        config.TeamSettings.RestrictTeamInvite = this.state.restrictTeamInvite;
        config.TeamSettings.RestrictPublicChannelCreation = this.state.restrictPublicChannelCreation;
        config.TeamSettings.RestrictPrivateChannelCreation = this.state.restrictPrivateChannelCreation;
        config.TeamSettings.RestrictPublicChannelManagement = this.state.restrictPublicChannelManagement;
        config.TeamSettings.RestrictPrivateChannelManagement = this.state.restrictPrivateChannelManagement;
        config.TeamSettings.RestrictPublicChannelDeletion = this.state.restrictPublicChannelDeletion;
        config.TeamSettings.RestrictPrivateChannelDeletion = this.state.restrictPrivateChannelDeletion;
        config.TeamSettings.RestrictPrivateChannelManageMembers = this.state.restrictPrivateChannelManageMembers;
        config.AnnouncementSettings.EnableBanner = this.state.enableBanner;
        config.AnnouncementSettings.BannerText = this.state.bannerText;
        config.AnnouncementSettings.BannerColor = this.state.bannerColor;
        config.AnnouncementSettings.BannerTextColor = this.state.bannerTextColor;
        config.AnnouncementSettings.AllowBannerDismissal = this.state.allowBannerDismissal;

        return config;
    }

    getStateFromConfig(config) {
        return {
            restrictPostDelete: config.ServiceSettings.RestrictPostDelete,
            allowEditPost: config.ServiceSettings.AllowEditPost,
            postEditTimeLimit: config.ServiceSettings.PostEditTimeLimit,
            restrictTeamInvite: config.TeamSettings.RestrictTeamInvite,
            restrictPublicChannelCreation: config.TeamSettings.RestrictPublicChannelCreation,
            restrictPrivateChannelCreation: config.TeamSettings.RestrictPrivateChannelCreation,
            restrictPublicChannelManagement: config.TeamSettings.RestrictPublicChannelManagement,
            restrictPrivateChannelManagement: config.TeamSettings.RestrictPrivateChannelManagement,
            restrictPublicChannelDeletion: config.TeamSettings.RestrictPublicChannelDeletion,
            restrictPrivateChannelDeletion: config.TeamSettings.RestrictPrivateChannelDeletion,
            restrictPrivateChannelManageMembers: config.TeamSettings.RestrictPrivateChannelManageMembers,
            enableBanner: config.AnnouncementSettings.EnableBanner,
            bannerText: config.AnnouncementSettings.BannerText,
            bannerColor: config.AnnouncementSettings.BannerColor,
            bannerTextColor: config.AnnouncementSettings.BannerTextColor,
            allowBannerDismissal: config.AnnouncementSettings.AllowBannerDismissal
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.general.policy'
                defaultMessage='Policy'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <DropdownSetting
                    id='restrictTeamInvite'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAll', 'All team members')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.teamInviteTitle'
                            defaultMessage='Enable sending team invites from:'
                        />
                    }
                    value={this.state.restrictTeamInvite}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.general.policy.teamInviteDescription'
                            defaultMessage='Set policy on who can invite others to a team using <b>Send Email Invite</b> to invite new users by email, or the <b>Get Team Invite Link</b> and <b>Add Members to Team</b> options from the Main Menu. If <b>Get Team Invite Link</b> is used to share a link, you can expire the invite code from <b>Team Settings</b> > <b>Invite Code</b> after the desired users join the team.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPublicChannelCreation'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAll', 'All team members')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPublicChannelCreationTitle'
                            defaultMessage='Enable public channel creation for:'
                        />
                    }
                    value={this.state.restrictPublicChannelCreation}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.restrictPublicChannelCreationDescription'
                            defaultMessage='Set policy on who can create public channels.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPublicChannelManagement'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAllChannel', 'All channel members')},
                        {value: Constants.PERMISSIONS_CHANNEL_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsChannelAdmin', 'Channel, Team and System Admins')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPublicChannelManagementTitle'
                            defaultMessage='Enable public channel renaming for:'
                        />
                    }
                    value={this.state.restrictPublicChannelManagement}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.restrictPublicChannelManagementDescription'
                            defaultMessage='Set policy on who can rename and set the header or purpose for public channels.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPublicChannelDeletion'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAllChannel', 'All channel members')},
                        {value: Constants.PERMISSIONS_CHANNEL_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsChannelAdmin', 'Channel, Team and System Admins')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPublicChannelDeletionTitle'
                            defaultMessage='Enable public channel deletion for:'
                        />
                    }
                    value={this.state.restrictPublicChannelDeletion}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.restrictPublicChannelDeletionDescription'
                            defaultMessage='Set policy on who can delete public channels. Deleted channels can be recovered from the database using a {commandLineToolLink}.'
                            values={{
                                commandLineToolLink: (
                                    <a
                                        href='https://docs.mattermost.com/administration/command-line-tools.html'
                                        target='_blank'
                                        rel='noopener noreferrer'
                                    >
                                        <FormattedMessage
                                            id='admin.general.policy.restrictPublicChannelDeletionCommandLineToolLink'
                                            defaultMessage='command line tool'
                                        />
                                    </a>
                                )
                            }}
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPrivateChannelCreation'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAll', 'All team members')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelCreationTitle'
                            defaultMessage='Enable private channel creation for:'
                        />
                    }
                    value={this.state.restrictPrivateChannelCreation}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelCreationDescription'
                            defaultMessage='Set policy on who can create private channels.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPrivateChannelManagement'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAllChannel', 'All channel members')},
                        {value: Constants.PERMISSIONS_CHANNEL_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsChannelAdmin', 'Channel, Team and System Admins')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelManagementTitle'
                            defaultMessage='Enable private channel renaming for:'
                        />
                    }
                    value={this.state.restrictPrivateChannelManagement}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelManagementDescription'
                            defaultMessage='Set policy on who can rename and set the header or purpose for private channels.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPrivateChannelManageMembers'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAllChannel', 'All channel members')},
                        {value: Constants.PERMISSIONS_CHANNEL_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsChannelAdmin', 'Channel, Team and System Admins')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelManageMembersTitle'
                            defaultMessage='Enable managing of private group members for:'
                        />
                    }
                    value={this.state.restrictPrivateChannelManageMembers}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelManageMembersDescription'
                            defaultMessage='Set policy on who can add and remove members from private groups.'
                        />
                    }
                />
                <DropdownSetting
                    id='restrictPrivateChannelDeletion'
                    values={[
                        {value: Constants.PERMISSIONS_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsAllChannel', 'All channel members')},
                        {value: Constants.PERMISSIONS_CHANNEL_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsChannelAdmin', 'Channel, Team and System Admins')},
                        {value: Constants.PERMISSIONS_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsAdmin', 'Team and System Admins')},
                        {value: Constants.PERMISSIONS_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelDeletionTitle'
                            defaultMessage='Enable private channel deletion for:'
                        />
                    }
                    value={this.state.restrictPrivateChannelDeletion}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.restrictPrivateChannelDeletionDescription'
                            defaultMessage='Set policy on who can delete private channels. Deleted channels can be recovered from the database using a {commandLineToolLink}.'
                            values={{
                                commandLineToolLink: (
                                    <a
                                        href='https://docs.mattermost.com/administration/command-line-tools.html'
                                        target='_blank'
                                        rel='noopener noreferrer'
                                    >
                                        <FormattedMessage
                                            id='admin.general.policy.restrictPrivateChannelDeletionCommandLineToolLink'
                                            defaultMessage='command line tool'
                                        />
                                    </a>
                                )
                            }}
                        />
                    }
                />
                <RadioSetting
                    id='restrictPostDelete'
                    values={[
                        {value: Constants.PERMISSIONS_DELETE_POST_ALL, text: Utils.localizeMessage('admin.general.policy.permissionsDeletePostAll', 'Message authors can delete their own messages, and Administrators can delete any message')},
                        {value: Constants.PERMISSIONS_DELETE_POST_TEAM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsDeletePostAdmin', 'Team Admins and System Admins')},
                        {value: Constants.PERMISSIONS_DELETE_POST_SYSTEM_ADMIN, text: Utils.localizeMessage('admin.general.policy.permissionsDeletePostSystemAdmin', 'System Admins')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.general.policy.restrictPostDeleteTitle'
                            defaultMessage='Allow which users to delete messages:'
                        />
                    }
                    value={this.state.restrictPostDelete}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.general.policy.restrictPostDeleteDescription'
                            defaultMessage='Set policy on who has permission to delete messages.'
                        />
                    }
                />
                <PostEditSetting
                    id='allowEditPost'
                    timeLimitId='postEditTimeLimit'
                    label={
                        <FormattedMessage
                            id='admin.general.policy.allowEditPostTitle'
                            defaultMessage='Allow users to edit their messages:'
                        />
                    }
                    value={this.state.allowEditPost}
                    timeLimitValue={this.state.postEditTimeLimit}
                    onChange={this.handleChange}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.general.policy.allowEditPostDescription'
                            defaultMessage='Set policy on the length of time authors have to edit their messages after posting.'
                        />
                    }
                />
                <BooleanSetting
                    id='enableBanner'
                    label={
                        <FormattedMessage
                            id='admin.general.policy.enableBannerTitle'
                            defaultMessage='Enable Announcement Banner:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.enableBannerDesc'
                            defaultMessage='Enable an announcement banner across all teams.'
                        />
                    }
                    value={this.state.enableBanner}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='bannerText'
                    label={
                        <FormattedMessage
                            id='admin.general.policy.bannerTextTitle'
                            defaultMessage='Banner Text:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.bannerTextDesc'
                            defaultMessage='Text that will appear in the announcement banner.'
                        />
                    }
                    value={this.state.bannerText}
                    onChange={this.handleChange}
                    disabled={!this.state.enableBanner}
                />
                <ColorSetting
                    id='bannerColor'
                    label={
                        <FormattedMessage
                            id='admin.general.policy.bannerColorTitle'
                            defaultMessage='Banner Color:'
                        />
                    }
                    value={this.state.bannerColor}
                    onChange={this.handleChange}
                    disabled={!this.state.enableBanner}
                />
                <ColorSetting
                    id='bannerTextColor'
                    label={
                        <FormattedMessage
                            id='admin.general.policy.bannerTextColorTitle'
                            defaultMessage='Banner Text Color:'
                        />
                    }
                    value={this.state.bannerTextColor}
                    onChange={this.handleChange}
                    disabled={!this.state.enableBanner}
                />
                <BooleanSetting
                    id='allowBannerDismissal'
                    label={
                        <FormattedMessage
                            id='admin.general.policy.allowBannerDismissalTitle'
                            defaultMessage='Allow Banner Dismissal:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.general.policy.allowBannerDismissalDesc'
                            defaultMessage='When true, users can dismiss the banner until its next update. When false, the banner is permanently visible until it is turned off by the System Admin.'
                        />
                    }
                    value={this.state.allowBannerDismissal}
                    onChange={this.handleChange}
                    disabled={!this.state.enableBanner}
                />
            </SettingsGroup>
        );
    }
}
