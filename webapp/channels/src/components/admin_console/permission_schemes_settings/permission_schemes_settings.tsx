// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl, type MessageDescriptor, type WrappedComponentProps} from 'react-intl';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {Scheme, SchemeScope, SchemesState} from '@mattermost/types/schemes';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ExternalLink from 'components/external_link';
import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanelWithLink from 'components/widgets/admin_console/admin_panel_with_link';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {DocLinks, LicenseSkus} from 'utils/constants';

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
} & WrappedComponentProps;

type State = {
    loading: boolean;
    loadingMore: boolean;
    page: number;
    phase2MigrationIsComplete: boolean;
};

const messages = defineMessages({
    teamOverrideSchemesNoSchemes: {id: 'admin.permissions.teamOverrideSchemesNoSchemes', defaultMessage: 'No team override schemes created.'},
    loadMoreSchemes: {id: 'admin.permissions.loadMoreSchemes', defaultMessage: 'Load more schemes'},
    introBanner: {id: 'admin.permissions.introBanner', defaultMessage: 'Permission Schemes set the default permissions for Team Admins, Channel Admins and everyone else. Learn more about permission schemes in our <link>documentation</link>.'},
    systemSchemeBannerTitle: {id: 'admin.permissions.systemSchemeBannerTitle', defaultMessage: 'System Scheme'},
    systemSchemeBannerText: {id: 'admin.permissions.systemSchemeBannerText', defaultMessage: 'Set the default permissions inherited by all teams unless a <link>Team Override Scheme</link> is applied.'},
    systemSchemeBannerButton: {id: 'admin.permissions.systemSchemeBannerButton', defaultMessage: 'Edit Scheme'},
    teamOverrideSchemesTitle: {id: 'admin.permissions.teamOverrideSchemesTitle', defaultMessage: 'Team Override Schemes'},
    teamOverrideSchemesBannerText: {id: 'admin.permissions.teamOverrideSchemesBannerText', defaultMessage: 'Use when specific teams need permission exceptions to the <link>System Scheme</link>'},
    teamOverrideSchemesNewButton: {id: 'admin.permissions.teamOverrideSchemesNewButton', defaultMessage: 'New Team Override Scheme'},
});

export const searchableStrings = [
    messages.teamOverrideSchemesNoSchemes,
    messages.loadMoreSchemes,
    messages.introBanner,
    messages.systemSchemeBannerTitle,
    messages.systemSchemeBannerText,
    messages.systemSchemeBannerButton,
    messages.teamOverrideSchemesTitle,
    messages.teamOverrideSchemesBannerText,
    messages.teamOverrideSchemesNewButton,
];

class PermissionSchemesSettings extends React.PureComponent<Props & RouteComponentProps, State> {
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
    };

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

        if (this.props.jobsAreEnabled && !this.props.clusterIsEnabled) {
            return this.teamOverrideUnavalableView(
                defineMessage({
                    id: 'admin.permissions.teamOverrideSchemesInProgress',
                    defaultMessage: 'Migration job in progress: Team Override Schemes are not available until the job server completes the permissions migration. Learn more in the <link>documentation</link>.',
                }),
            );
        }

        return this.teamOverrideUnavalableView(
            defineMessage({
                id: 'admin.permissions.teamOverrideSchemesNoJobsEnabled',
                defaultMessage: 'Migration job on hold: Team Override Schemes are not available until the job server can execute the permissions migration. The job will be automatically started when the job server is enabled. Learn more in the <link>documentation</link>.',
            }),
        );
    };

    teamOverrideUnavalableView = (message: MessageDescriptor) => {
        return (
            <div className='team-override-unavailable'>
                <div className='team-override-unavailable__inner'>
                    <FormattedMessage
                        {...message}
                        values={{
                            link: (chunks) => (
                                <ExternalLink
                                    href='https://docs.mattermost.com/administration/config-settings.html#jobs'
                                    location='permission_scheme_settings'
                                >
                                    {chunks}
                                </ExternalLink>
                            ),
                        }}
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
                    title={messages.teamOverrideSchemesTitle}
                    subtitle={messages.teamOverrideSchemesBannerText}
                    subtitleValues={{
                        link: (msg: React.ReactNode) => (
                            <ExternalLink
                                href={DocLinks.ONBOARD_ADVANCED_PERMISSIONS}
                                location='permission_scheme_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                    url='/admin_console/user_management/permissions/team_override_scheme'
                    disabled={(teamOverrideView !== null) || this.props.isDisabled}
                    linkText={messages.teamOverrideSchemesNewButton}
                >
                    {schemes.length === 0 && teamOverrideView === null &&
                        <div className='no-team-schemes'>
                            <FormattedMessage
                                {...messages.teamOverrideSchemesNoSchemes}
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
                                text={this.props.intl.formatMessage({id: 'admin.permissions.loadingMoreSchemes', defaultMessage: 'Loading...'})}
                            >
                                <FormattedMessage {...messages.loadMoreSchemes}/>
                            </LoadingWrapper>
                        </button>}
                </AdminPanelWithLink>
            );
        }
        return false;
    };

    render = () => {
        if (this.state.loading) {
            return (<LoadingScreen/>);
        }

        const teamOverrideView = this.teamOverrideSchemesMigrationView();

        return (
            <div className='wrapper--fixed'>
                <AdminHeader>
                    <FormattedMessage
                        id='admin.permissions.permissionSchemes'
                        defaultMessage='Permission Schemes'
                    />
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='banner info'>
                            <div className='banner__content'>
                                <span>
                                    <FormattedMessage
                                        {...messages.introBanner}
                                        values={{
                                            link: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href={DocLinks.ONBOARD_ADVANCED_PERMISSIONS}
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
                            title={messages.systemSchemeBannerTitle}
                            subtitle={messages.systemSchemeBannerText}
                            subtitleValues={{
                                link: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href={DocLinks.ONBOARD_ADVANCED_PERMISSIONS}
                                        location='permission_scheme_settings'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                            url='/admin_console/user_management/permissions/system_scheme'
                            disabled={teamOverrideView !== null}
                            linkText={messages.systemSchemeBannerButton}
                        />

                        {this.renderTeamOverrideSchemes()}
                    </div>
                </div>
            </div>
        );
    };
}

export default injectIntl(PermissionSchemesSettings);
