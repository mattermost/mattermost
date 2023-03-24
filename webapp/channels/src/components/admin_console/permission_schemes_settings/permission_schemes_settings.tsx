// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {RouteComponentProps} from 'react-router-dom';

import {t} from 'utils/i18n';
import * as Utils from 'utils/utils';

import LoadingScreen from 'components/loading_screen';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import FormattedAdminHeader from 'components/widgets/admin_console/formatted_admin_header';
import AdminPanelWithLink from 'components/widgets/admin_console/admin_panel_with_link';

import {ActionResult} from 'mattermost-redux/types/actions';

import {Scheme, SchemeScope, SchemesState} from '@mattermost/types/schemes';

import {LicenseSkus} from 'utils/constants';

import ExternalLink from 'components/external_link';

import PermissionsSchemeSummary from './permissions_scheme_summary';

const PAGE_SIZE = 30;
const PHASE_2_MIGRATION_IMCOMPLETE_STATUS_CODE = 501;

export type Props = {
    schemes: SchemesState['schemes'];
    jobsAreEnabled?: boolean;
    clusterIsEnabled?: boolean;
    license: {
        CustomPermissionsSchemes: string;
        SkuShortName: string;
    };
    actions: {
        loadSchemes: (scope: SchemeScope, page: number, perPage: number) => Promise<ActionResult>;
        loadSchemeTeams: (id: string) => Promise<ActionResult>;
    };
    isDisabled?: boolean;
};

type State = {
    loading: boolean;
    loadingMore: boolean;
    page: number;
    phase2MigrationIsComplete: boolean;
};
export default class PermissionSchemesSettings extends React.PureComponent<Props & RouteComponentProps, State> {
    constructor(props: Props & RouteComponentProps) {
        super(props);
        this.state = {
            loading: true,
            loadingMore: false,
            page: 0,
            phase2MigrationIsComplete: false,
        };
    }

    static defaultProps = {
        schemes: {},
    };

    componentDidMount() {
        let phase2MigrationIsComplete = true; // Assume migration is complete unless HTTP status code says otherwise.
        this.props.actions.loadSchemes('team', 0, PAGE_SIZE).then((schemes) => {
            if (schemes.error.status_code === PHASE_2_MIGRATION_IMCOMPLETE_STATUS_CODE) {
                phase2MigrationIsComplete = false;
            }
            const promises = [];
            for (const scheme of schemes.data) {
                promises.push(this.props.actions.loadSchemeTeams(scheme.id));
            }
            Promise.all(promises).then(() => this.setState({loading: false, phase2MigrationIsComplete}));
        }).catch(() => {
            this.setState({loading: false, phase2MigrationIsComplete});
        });
    }

    loadMoreSchemes = () => {
        this.setState({loadingMore: true});
        this.props.actions.loadSchemes('team', this.state.page + 1, PAGE_SIZE).then((schemes) => {
            const promises = [];
            for (const scheme of schemes.data) {
                promises.push(this.props.actions.loadSchemeTeams(scheme.id));
            }
            Promise.all(promises).then(() => this.setState({loadingMore: false, page: this.state.page + 1}));
        });
    }

    // |RunJobs && !EnableCluster|(*App).IsPhase2MigrationCompleted|View                                                   |
    // |-------------------------|---------------------------------|-------------------------------------------------------|
    // |true                     |true                             |null                                                   |
    // |false                    |true                             |null (Jobs were disabled after a successful migration.)|
    // |false                    |false                            |On hold view.                                          |
    // |true                     |false                            |In progress view.                                      |
    teamOverrideSchemesMigrationView = () => {
        if (this.state.phase2MigrationIsComplete) {
            return null;
        }

        const docLink = (
            <ExternalLink
                href='https://docs.mattermost.com/administration/config-settings.html#jobs'
                location='permission_scheme_settings'
            >
                <FormattedMessage
                    id='admin.permissions.documentationLinkText'
                    defaultMessage='documentation'
                />
            </ExternalLink>
        );

        if (this.props.jobsAreEnabled && !this.props.clusterIsEnabled) {
            return this.teamOverrideUnavalableView(
                t('admin.permissions.teamOverrideSchemesInProgress'),
                'Migration job in progress: Team Override Schemes are not available until the job server completes the permissions migration. Learn more in the {documentationLink}.',
                docLink,
            );
        }

        return this.teamOverrideUnavalableView(
            t('admin.permissions.teamOverrideSchemesNoJobsEnabled'),
            'Migration job on hold: Team Override Schemes are not available until the job server can execute the permissions migration. The job will be automatically started when the job server is enabled. Learn more in the {documentationLink}.',
            docLink,
        );
    }

    teamOverrideUnavalableView = (id: string, defaultMsg: string, documentationLink: React.ReactNode) => {
        return (
            <div className='team-override-unavailable'>
                <div className='team-override-unavailable__inner'>
                    <FormattedMessage
                        id={id}
                        defaultMessage={defaultMsg}
                        values={{documentationLink}}
                    />
                </div>
            </div>
        );
    };

    renderTeamOverrideSchemes = () => {
        const schemes = Object.values(this.props.schemes).map((scheme: Scheme) => (
            <PermissionsSchemeSummary
                scheme={scheme}
                history={this.props.history}
                key={scheme.id}
                isDisabled={this.props.isDisabled}
                location={this.props.location}
                match={this.props.match}
            />
        ));
        const hasCustomSchemes = this.props.license.CustomPermissionsSchemes === 'true' || this.props.license.SkuShortName === LicenseSkus.Professional;
        const teamOverrideView = this.teamOverrideSchemesMigrationView();

        if (hasCustomSchemes) {
            return (
                <AdminPanelWithLink
                    id='team-override-schemes'
                    className='permissions-block'
                    titleId={t('admin.permissions.teamOverrideSchemesTitle')}
                    titleDefault='Team Override Schemes'
                    subtitleId={t('admin.permissions.teamOverrideSchemesBannerText')}
                    subtitleDefault='Use when specific teams need permission exceptions to the <link>System Scheme</link>'
                    subtitleValues={{
                        link: (msg: React.ReactNode) => (
                            <ExternalLink
                                href='https://docs.mattermost.com/onboard/advanced-permissions.html'
                                location='permission_scheme_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                    url='/admin_console/user_management/permissions/team_override_scheme'
                    disabled={(teamOverrideView !== null) || this.props.isDisabled}
                    linkTextId={t('admin.permissions.teamOverrideSchemesNewButton')}
                    linkTextDefault='New Team Override Scheme'
                >
                    {schemes.length === 0 && teamOverrideView === null &&
                        <div className='no-team-schemes'>
                            <FormattedMessage
                                id='admin.permissions.teamOverrideSchemesNoSchemes'
                                defaultMessage='No team override schemes created.'
                            />
                        </div>}
                    {teamOverrideView}
                    {schemes.length > 0 && schemes}
                    {schemes.length === (PAGE_SIZE * (this.state.page + 1)) &&
                        <button
                            type='button'
                            className='more-schemes theme style--none color--link'
                            onClick={this.loadMoreSchemes}
                            disabled={this.props.isDisabled || this.state.loadingMore}
                        >
                            <LoadingWrapper
                                loading={this.state.loadingMore}
                                text={Utils.localizeMessage('admin.permissions.loadingMoreSchemes', 'Loading...')}
                            >
                                <FormattedMessage
                                    id='admin.permissions.loadMoreSchemes'
                                    defaultMessage='Load more schemes'
                                />
                            </LoadingWrapper>
                        </button>}
                </AdminPanelWithLink>
            );
        }
        return false;
    }

    render = () => {
        if (this.state.loading) {
            return (<LoadingScreen/>);
        }

        const teamOverrideView = this.teamOverrideSchemesMigrationView();

        return (
            <div className='wrapper--fixed'>
                <FormattedAdminHeader
                    id='admin.permissions.permissionSchemes'
                    defaultMessage='Permission Schemes'
                />

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='banner info'>
                            <div className='banner__content'>
                                <span>
                                    <FormattedMessage
                                        id='admin.permissions.introBanner'
                                        defaultMessage='Permission Schemes set the default permissions for Team Admins, Channel Admins and everyone else. Learn more about permission schemes in our <link>documentation</link>.'
                                        values={{
                                            link: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href='https://docs.mattermost.com/onboard/advanced-permissions.html'
                                                    location='permission_scheme_settings'
                                                >
                                                    {msg}
                                                </ExternalLink>
                                            ),
                                        }}
                                    />
                                </span>
                            </div>
                        </div>

                        <AdminPanelWithLink
                            id='systemScheme'
                            titleId={t('admin.permissions.systemSchemeBannerTitle')}
                            titleDefault='System Scheme'
                            subtitleId={t('admin.permissions.systemSchemeBannerText')}
                            subtitleDefault='Set the default permissions inherited by all teams unless a <link>Team Override Scheme</link> is applied.'
                            subtitleValues={{
                                link: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/onboard/advanced-permissions.html'
                                        location='permission_scheme_settings'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                            url='/admin_console/user_management/permissions/system_scheme'
                            disabled={teamOverrideView !== null}
                            linkTextId={t('admin.permissions.systemSchemeBannerButton')}
                            linkTextDefault='Edit Scheme'
                        />

                        {this.renderTeamOverrideSchemes()}
                    </div>
                </div>
            </div>
        );
    };
}

t('admin.permissions.group.delete_posts.description');
t('admin.permissions.group.delete_posts.name');
t('admin.permissions.group.integrations.description');
t('admin.permissions.group.integrations.name');
t('admin.permissions.group.posts.description');
t('admin.permissions.group.posts.name');
t('admin.permissions.group.private_channel.description');
t('admin.permissions.group.private_channel.name');
t('admin.permissions.group.public_channel.description');
t('admin.permissions.group.public_channel.name');
t('admin.permissions.group.reactions.description');
t('admin.permissions.group.reactions.name');
t('admin.permissions.group.send_invites.description');
t('admin.permissions.group.send_invites.name');
t('admin.permissions.group.teams.description');
t('admin.permissions.group.teams.name');
t('admin.permissions.group.edit_posts.description');
t('admin.permissions.group.edit_posts.name');
t('admin.permissions.group.teams_team_scope.description');
t('admin.permissions.group.teams_team_scope.name');
t('admin.permissions.permission.assign_system_admin_role.description');
t('admin.permissions.permission.assign_system_admin_role.name');
t('admin.permissions.permission.convert_public_channel_to_private.description');
t('admin.permissions.permission.convert_public_channel_to_private.name');
t('admin.permissions.permission.convert_private_channel_to_public.description');
t('admin.permissions.permission.convert_private_channel_to_public.name');
t('admin.permissions.permission.create_direct_channel.description');
t('admin.permissions.permission.create_direct_channel.name');
t('admin.permissions.permission.create_group_channel.description');
t('admin.permissions.permission.create_group_channel.name');
t('admin.permissions.permission.create_post.description');
t('admin.permissions.permission.create_post.name');
t('admin.permissions.permission.create_private_channel.description');
t('admin.permissions.permission.create_private_channel.name');
t('admin.permissions.permission.create_public_channel.description');
t('admin.permissions.permission.create_public_channel.name');
t('admin.permissions.permission.create_team.description');
t('admin.permissions.permission.create_team.name');
t('admin.permissions.permission.create_user_access_token.description');
t('admin.permissions.permission.create_user_access_token.name');
t('admin.permissions.permission.delete_others_posts.description');
t('admin.permissions.permission.delete_others_posts.name');
t('admin.permissions.permission.delete_post.description');
t('admin.permissions.permission.delete_post.name');
t('admin.permissions.permission.delete_private_channel.description');
t('admin.permissions.permission.delete_private_channel.name');
t('admin.permissions.permission.delete_public_channel.description');
t('admin.permissions.permission.delete_public_channel.name');
t('admin.permissions.permission.edit_other_users.description');
t('admin.permissions.permission.edit_other_users.name');
t('admin.permissions.permission.edit_post.description');
t('admin.permissions.group.guest_reactions.description');
t('admin.permissions.group.guest_reactions.name');
t('admin.permissions.group.guest_create_post.description');
t('admin.permissions.group.guest_create_post.name');
t('admin.permissions.group.guest_create_private_channel.description');
t('admin.permissions.group.guest_create_private_channel.name');
t('admin.permissions.group.guest_delete_post.description');
t('admin.permissions.group.guest_delete_post.name');
t('admin.permissions.group.guest_edit_post.description');
t('admin.permissions.group.guest_edit_post.name');
t('admin.permissions.group.guest_use_channel_mentions.description');
t('admin.permissions.group.guest_use_channel_mentions.name');
t('admin.permissions.group.guest_use_group_mentions.description');
t('admin.permissions.group.guest_use_group_mentions.name');
t('admin.permissions.permission.edit_post.name');
t('admin.permissions.permission.import_team.description');
t('admin.permissions.permission.import_team.name');
t('admin.permissions.permission.list_team_channels.description');
t('admin.permissions.permission.list_team_channels.name');
t('admin.permissions.permission.list_users_without_team.description');
t('admin.permissions.permission.list_users_without_team.name');
t('admin.permissions.permission.manage_channel_roles.description');
t('admin.permissions.permission.manage_channel_roles.name');
t('admin.permissions.permission.create_emojis.description');
t('admin.permissions.permission.create_emojis.name');
t('admin.permissions.permission.delete_emojis.description');
t('admin.permissions.permission.delete_emojis.name');
t('admin.permissions.permission.delete_others_emojis.description');
t('admin.permissions.permission.delete_others_emojis.name');
t('admin.permissions.permission.manage_jobs.description');
t('admin.permissions.permission.manage_jobs.name');
t('admin.permissions.permission.manage_oauth.description');
t('admin.permissions.permission.manage_oauth.name');
t('admin.permissions.group.manage_private_channel_members_and_read_groups.description');
t('admin.permissions.group.manage_private_channel_members_and_read_groups.name');
t('admin.permissions.permission.manage_private_channel_properties.description');
t('admin.permissions.permission.manage_private_channel_properties.name');
t('admin.permissions.group.manage_public_channel_members_and_read_groups.description');
t('admin.permissions.group.manage_public_channel_members_and_read_groups.name');
t('admin.permissions.group.convert_public_channel_to_private.description');
t('admin.permissions.group.convert_public_channel_to_private.name');
t('admin.permissions.permission.manage_public_channel_properties.description');
t('admin.permissions.permission.manage_public_channel_properties.name');
t('admin.permissions.permission.manage_roles.description');
t('admin.permissions.permission.manage_roles.name');
t('admin.permissions.permission.manage_slash_commands.description');
t('admin.permissions.permission.manage_slash_commands.name');
t('admin.permissions.permission.manage_system.description');
t('admin.permissions.permission.manage_system.name');
t('admin.permissions.permission.manage_team.description');
t('admin.permissions.permission.manage_team.name');
t('admin.permissions.permission.manage_team_roles.description');
t('admin.permissions.permission.manage_team_roles.name');
t('admin.permissions.permission.manage_incoming_webhooks.description');
t('admin.permissions.permission.manage_incoming_webhooks.name');
t('admin.permissions.permission.manage_outgoing_webhooks.description');
t('admin.permissions.permission.manage_outgoing_webhooks.name');
t('admin.permissions.permission.permanent_delete_user.description');
t('admin.permissions.permission.permanent_delete_user.name');
t('admin.permissions.permission.read_channel.description');
t('admin.permissions.permission.read_channel.name');
t('admin.permissions.permission.read_user_access_token.description');
t('admin.permissions.permission.read_user_access_token.name');
t('admin.permissions.permission.remove_user_from_team.description');
t('admin.permissions.permission.remove_user_from_team.name');
t('admin.permissions.permission.revoke_user_access_token.description');
t('admin.permissions.permission.revoke_user_access_token.name');
t('admin.permissions.permission.upload_file.description');
t('admin.permissions.permission.upload_file.name');
t('admin.permissions.permission.use_channel_mentions.description');
t('admin.permissions.permission.use_channel_mentions.name');
t('admin.permissions.permission.use_group_mentions.description');
t('admin.permissions.permission.use_group_mentions.name');
t('admin.permissions.permission.view_team.description');
t('admin.permissions.permission.view_team.name');
t('admin.permissions.permission.edit_others_posts.description');
t('admin.permissions.permission.edit_others_posts.name');
t('admin.permissions.permission.invite_guest.name');
t('admin.permissions.permission.invite_guest.description');
t('admin.permissions.roles.all_users.name');
t('admin.permissions.roles.channel_admin.name');
t('admin.permissions.roles.channel_user.name');
t('admin.permissions.roles.system_admin.name');
t('admin.permissions.roles.system_user.name');
t('admin.permissions.roles.team_admin.name');
t('admin.permissions.roles.team_user.name');
t('admin.permissions.group.manage_shared_channels.name');
t('admin.permissions.group.manage_shared_channels.description');
t('admin.permissions.permission.manage_shared_channels.name');
t('admin.permissions.permission.manage_shared_channels.description');
t('admin.permissions.permission.manage_secure_connections.name');
t('admin.permissions.permission.manage_secure_connections.description');
t('admin.permissions.group.playbook_public.name');
t('admin.permissions.group.playbook_public.description');
t('admin.permissions.permission.playbook_public_create.name');
t('admin.permissions.permission.playbook_public_create.description');
t('admin.permissions.permission.playbook_public_manage_properties.name');
t('admin.permissions.permission.playbook_public_manage_properties.description');
t('admin.permissions.permission.playbook_public_manage_members.name');
t('admin.permissions.permission.playbook_public_manage_members.description');
t('admin.permissions.permission.playbook_public_make_private.name');
t('admin.permissions.permission.playbook_public_make_private.description');
t('admin.permissions.group.playbook_private.name');
t('admin.permissions.group.playbook_private.description');
t('admin.permissions.permission.playbook_private_create.name');
t('admin.permissions.permission.playbook_private_create.description');
t('admin.permissions.permission.playbook_private_manage_properties.name');
t('admin.permissions.permission.playbook_private_manage_properties.description');
t('admin.permissions.permission.playbook_private_manage_members.name');
t('admin.permissions.permission.playbook_private_manage_members.description');
t('admin.permissions.permission.playbook_private_make_public.name');
t('admin.permissions.permission.playbook_private_make_public.description');
t('admin.permissions.group.runs.name');
t('admin.permissions.group.runs.description');
t('admin.permissions.permission.run_create.name');
t('admin.permissions.permission.run_create.description');
t('admin.permissions.group.custom_groups.name');
t('admin.permissions.group.custom_groups.description');
t('admin.permissions.permission.create_custom_group.name');
t('admin.permissions.permission.create_custom_group.description');
t('admin.permissions.permission.manage_custom_group_members.name');
t('admin.permissions.permission.manage_custom_group_members.description');
t('admin.permissions.permission.delete_custom_group.name');
t('admin.permissions.permission.delete_custom_group.description');
t('admin.permissions.permission.restore_custom_group.name');
t('admin.permissions.permission.restore_custom_group.description');
t('admin.permissions.permission.edit_custom_group.name');
t('admin.permissions.permission.edit_custom_group.description');
