// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Route, Switch, Redirect} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import type {CloudState} from '@mattermost/types/cloud';
import type {AdminConfig, ClientLicense, EnvironmentConfig} from '@mattermost/types/config';
import type {Role} from '@mattermost/types/roles';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SchemaAdminSettings from 'components/admin_console/schema_admin_settings';
import SearchKeywordMarking from 'components/admin_console/search_keyword_marking';
import AnnouncementBarController from 'components/announcement_bar';
import BackstageNavbar from 'components/backstage/components/backstage_navbar';
import DiscardChangesModal from 'components/discard_changes_modal';
import ModalController from 'components/modal_controller';
import SystemNotice from 'components/system_notice';

import {applyTheme, resetTheme} from 'utils/utils';

import {LhsItemType} from 'types/store/lhs';

import AdminSidebar from './admin_sidebar';
import type {AdminDefinitionSubSection, AdminDefinitionSection} from './types';

import type {PropsFromRedux} from './index';

export type Props = PropsFromRedux & RouteComponentProps;

type State = {
    search: string;
}

// not every page in the system console will need the license and config, but the vast majority will
type ExtraProps = {
    enterpriseReady: boolean;
    license: ClientLicense;
    config: Partial<AdminConfig>;
    environmentConfig: Partial<EnvironmentConfig>;
    setNavigationBlocked: (blocked: boolean) => void;
    roles: Record<string, Role>;
    editRole: (role: Role) => void;
    patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
    cloud: CloudState;
    isCurrentUserSystemAdmin: boolean;
}

class AdminConsole extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = {
            search: '',
        };
    }

    public componentDidMount(): void {
        this.props.actions.getConfig();
        this.props.actions.getEnvironmentConfig();
        this.props.actions.loadRolesIfNeeded(['channel_user', 'team_user', 'system_user', 'channel_admin', 'team_admin', 'system_admin', 'system_user_manager', 'system_custom_group_admin', 'system_read_only_admin', 'system_manager']);
        this.props.actions.selectLhsItem(LhsItemType.None);
        this.props.actions.selectTeam('');
        document.body.classList.add('console__body');
        document.getElementById('root')?.classList.add('console__root');
        resetTheme();
    }

    public componentWillUnmount(): void {
        document.body.classList.remove('console__body');
        document.getElementById('root')?.classList.remove('console__root');
        applyTheme(this.props.currentTheme);

        // Reset the admin console users management table properties
        this.props.actions.setAdminConsoleUsersManagementTableProperties();
    }

    private handleSearchChange = (search: string) => {
        this.setState({search});
    };

    private mainRolesLoaded(roles: Record<string, Role>) {
        return (
            roles &&
            roles.channel_admin &&
            roles.channel_user &&
            roles.team_admin &&
            roles.team_user &&
            roles.system_admin &&
            roles.system_user &&
            roles.system_user_manager &&
            roles.system_read_only_admin &&
            roles.system_custom_group_admin &&
            roles.system_manager
        );
    }

    private renderRoutes = (extraProps: ExtraProps) => {
        const {adminDefinition, config, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin} = this.props;

        const schemas: AdminDefinitionSubSection[] = Object.values(adminDefinition).flatMap((section: AdminDefinitionSection) => {
            let isSectionHidden = false;
            if (typeof section.isHidden === 'function') {
                isSectionHidden = section.isHidden(config, this.state, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin);
            } else {
                isSectionHidden = Boolean(section.isHidden);
            }
            if (isSectionHidden) {
                return [];
            }
            return Object.values(section.subsections);
        });

        let defaultUrl = '';

        const schemaRoutes = schemas.map((item: AdminDefinitionSubSection, index: number) => {
            if (typeof item.isHidden !== 'undefined') {
                const isHidden = (typeof item.isHidden === 'function') ? item.isHidden(config, this.state, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin) : Boolean(item.isHidden);
                if (isHidden) {
                    return false;
                }
            }

            let isItemDisabled: boolean;

            if (typeof item.isDisabled === 'function') {
                isItemDisabled = item.isDisabled(config, this.state, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin);
            } else {
                isItemDisabled = Boolean(item.isDisabled);
            }

            if (!isItemDisabled && defaultUrl === '') {
                const {url} = schemas[index];

                // Don't use a url as default if it requires an additional ID
                // in the path.
                if (!url.includes(':')) {
                    defaultUrl = url;
                }
            }

            return (
                <Route
                    key={item.url}
                    path={`${this.props.match.url}/${item.url}`}
                    render={(props) => (
                        <SchemaAdminSettings
                            {...extraProps}
                            {...props}
                            consoleAccess={this.props.consoleAccess}
                            schema={item.schema}
                            isDisabled={isItemDisabled}
                        />
                    )}
                />
            );
        });

        return (
            <Switch>
                {schemaRoutes}
                {<Redirect to={`${this.props.match.url}/${defaultUrl}`}/>}
            </Switch>
        );
    };

    public render(): JSX.Element | null {
        const {
            license,
            config,
            environmentConfig,
            showNavigationPrompt,
            roles,
        } = this.props;
        const {setNavigationBlocked, cancelNavigation, confirmNavigation, editRole, patchConfig} = this.props.actions;

        if (!this.props.currentUserHasAnAdminRole) {
            return (
                <Redirect to={this.props.unauthorizedRoute}/>
            );
        }

        if (!this.mainRolesLoaded(this.props.roles)) {
            return null;
        }

        if (Object.keys(config).length === 0) {
            return <div/>;
        }

        if (config && Object.keys(config).length === 0 && config.constructor === Object) {
            return (
                <div className='admin-console__wrapper admin-console'/>
            );
        }

        const extraProps: ExtraProps = {
            enterpriseReady: this.props.buildEnterpriseReady,
            license,
            config,
            environmentConfig,
            setNavigationBlocked,
            roles,
            editRole,
            patchConfig,
            cloud: this.props.cloud,
            isCurrentUserSystemAdmin: this.props.isCurrentUserSystemAdmin,
        };

        return (
            <>
                <AnnouncementBarController/>
                <SystemNotice/>
                <BackstageNavbar team={this.props.team}/>
                <AdminSidebar onSearchChange={this.handleSearchChange}/>
                <div
                    className='admin-console__wrapper admin-console'
                    id='adminConsoleWrapper'
                >
                    <SearchKeywordMarking
                        keyword={this.state.search}
                        pathname={this.props.location.pathname}
                    >
                        {this.renderRoutes(extraProps)}
                    </SearchKeywordMarking>
                </div>
                <DiscardChangesModal
                    show={showNavigationPrompt}
                    onConfirm={confirmNavigation}
                    onCancel={cancelNavigation}
                />
                <ModalController/>
            </>
        );
    }
}

export default AdminConsole;
