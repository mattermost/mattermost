// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CloudState, Product} from '@mattermost/types/cloud';
import {AdminConfig, EnvironmentConfig, ClientLicense} from '@mattermost/types/config';
import {Role} from '@mattermost/types/roles';
import {DeepPartial} from '@mattermost/types/utilities';
import React from 'react';
import {Route, Switch, Redirect} from 'react-router-dom';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {ActionFunc} from 'mattermost-redux/types/actions';

import SchemaAdminSettings from 'components/admin_console/schema_admin_settings';
import AnnouncementBarController from 'components/announcement_bar';
import BackstageNavbar from 'components/backstage/components/backstage_navbar';
import DelinquencyModal from 'components/delinquency_modal';
import DiscardChangesModal from 'components/discard_changes_modal';
import ModalController from 'components/modal_controller';
import SystemNotice from 'components/system_notice';

import {LhsItemType} from 'types/store/lhs';
import {applyTheme, resetTheme} from 'utils/utils';

import AdminSidebar from './admin_sidebar';
import Highlight from './highlight';

import type {PropsFromRedux} from './index';

export interface Props extends PropsFromRedux {
    match: {url: string};
    currentTheme: Theme;
}

type State = {
    filter: string;
}

// not every page in the system console will need the license and config, but the vast majority will
type ExtraProps = {
    enterpriseReady: boolean;
    license?: Record<string, any>;
    config?: DeepPartial<AdminConfig>;
    environmentConfig?: Partial<EnvironmentConfig>;
    setNavigationBlocked?: () => void;
    roles?: Record<string, Role>;
    editRole?: (role: Role) => void;
    updateConfig?: (config: AdminConfig) => ActionFunc;
    cloud: CloudState;
    isCurrentUserSystemAdmin: boolean;
}

type ConsoleAccess = {
    read: Record<string, boolean>;
    write: Record<string, boolean>;
}

type Item = {
    isHidden?: (config?: Record<string, any>, state?: Record<string, any>, license?: Record<string, any>, buildEnterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isCurrentUserSystemAdmin?: boolean) => boolean;
    isDisabled?: (config?: Record<string, any>, state?: Record<string, any>, license?: Record<string, any>, buildEnterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isCurrentUserSystemAdmin?: boolean) => boolean;
    schema: Record<string, any>;
    url: string;
    restrictedIndicator?: {
        value: (cloud: CloudState) => React.ReactNode;
        shouldDisplay: (license: ClientLicense, subscriptionProduct?: Product) => boolean;
    };
}

export default class AdminConsole extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = {
            filter: '',
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
    }

    private onFilterChange = (filter: string) => {
        this.setState({filter});
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

        const schemas: Item[] = Object.values(adminDefinition).reduce((acc, section) => {
            let items: Item[] = [];

            let isSectionHidden = false;
            Object.entries(section).find(([key, value]) => {
                if (key === 'isHidden') {
                    if (typeof value === 'function') {
                        isSectionHidden = value(config, this.state, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin);
                    } else {
                        isSectionHidden = Boolean(value);
                    }
                }
                return null;
            });

            if (!isSectionHidden) {
                items = Object.values(section).filter((item: Item) => Boolean(item.schema));
            }
            return acc.concat(items);
        }, [] as Item[]);

        let defaultUrl = '';

        const schemaRoutes = schemas.map((item: Item, index: number) => {
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
        const {setNavigationBlocked, cancelNavigation, confirmNavigation, editRole, updateConfig} = this.props.actions;

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

        const discardChangesModal: JSX.Element = (
            <DiscardChangesModal
                show={showNavigationPrompt}
                onConfirm={confirmNavigation}
                onCancel={cancelNavigation}
            />
        );

        const extraProps: ExtraProps = {
            enterpriseReady: this.props.buildEnterpriseReady,
            license,
            config,
            environmentConfig,
            setNavigationBlocked,
            roles,
            editRole,
            updateConfig,
            cloud: this.props.cloud,
            isCurrentUserSystemAdmin: this.props.isCurrentUserSystemAdmin,
        };
        return (
            <>
                <AnnouncementBarController/>
                <SystemNotice/>
                <BackstageNavbar team={this.props.team}/>
                <AdminSidebar onFilterChange={this.onFilterChange}/>
                <div
                    className='admin-console__wrapper admin-console'
                    id='adminConsoleWrapper'
                >
                    <Highlight filter={this.state.filter}>
                        {this.renderRoutes(extraProps)}
                    </Highlight>
                </div>
                {discardChangesModal}
                <DelinquencyModal/>
                <ModalController/>
            </>
        );
    }
}
