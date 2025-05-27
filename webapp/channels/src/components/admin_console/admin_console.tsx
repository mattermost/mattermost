// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Location} from 'history';
import type {RefCallback} from 'react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
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

/**
 * Focus or scroll to a provided hash for the given {@link Location}.
 * @returns a ref callback that should to be attached to an ancestor of the target hash element.
 * @remarks emulates standard browser URL hash scroll-to behavior, but also works in custom or nested scroll containers.
 */
const useFocusScroller = (location: Location): RefCallback<HTMLElement> => {
    const lastFocusedLocation = useRef<Location>();

    return useCallback((node) => {
        if (!node || !location.hash || lastFocusedLocation.current === location) {
            // if there is no node or hash, or if we've already focused the hash for this location
            return;
        }

        const id = decodeURIComponent(location.hash.substring(1));

        if (!id) {
            return;
        }

        const element = document.getElementById(id);

        if (!element) {
            return;
        }

        // focus the element, or scroll it into view if it couldn't be focused as a fallback
        element.focus();
        if (document.activeElement !== element) {
            element.scrollIntoView({behavior: 'auto'});
        }

        // only focus a hash for a given location once
        lastFocusedLocation.current = location;
    }, [location]);
};

const AdminConsole = (props: Props) => {
    const [search, setSearch] = useState('');
    const handleFocusScroller = useFocusScroller(props.location);

    useEffect(() => {
        props.actions.getConfig();
        props.actions.getEnvironmentConfig();
        props.actions.loadRolesIfNeeded(['channel_user', 'team_user', 'system_user', 'channel_admin', 'team_admin', 'system_admin', 'system_user_manager', 'system_custom_group_admin', 'system_read_only_admin', 'system_manager']);
        props.actions.selectLhsItem(LhsItemType.None);
        props.actions.selectTeam('');
        document.body.classList.add('console__body');
        document.getElementById('root')?.classList.add('console__root');
        resetTheme();

        return () => {
            document.body.classList.remove('console__body');
            document.getElementById('root')?.classList.remove('console__root');
            applyTheme(props.currentTheme);

            // Reset the admin console users management table properties
            props.actions.setAdminConsoleUsersManagementTableProperties();
        };
    }, []);

    const handleSearchChange = (searchTerm: string) => {
        setSearch(searchTerm);
    };

    const mainRolesLoaded = (roles: Record<string, Role>) => {
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
    };

    const renderRoutes = (extraProps: ExtraProps) => {
        const {adminDefinition, config, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin} = props;

        const schemas: AdminDefinitionSubSection[] = Object.values(adminDefinition).flatMap((section: AdminDefinitionSection) => {
            let isSectionHidden = false;
            if (typeof section.isHidden === 'function') {
                isSectionHidden = section.isHidden(config, {search}, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin);
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
                const isHidden = (typeof item.isHidden === 'function') ? item.isHidden(config, {search}, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin) : Boolean(item.isHidden);
                if (isHidden) {
                    return false;
                }
            }

            let isItemDisabled: boolean;

            if (typeof item.isDisabled === 'function') {
                isItemDisabled = item.isDisabled(config, {search}, license, buildEnterpriseReady, consoleAccess, cloud, isCurrentUserSystemAdmin);
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
                    path={`${props.match.url}/${item.url}`}
                    render={(routeProps) => (
                        <SchemaAdminSettings
                            {...extraProps}
                            {...routeProps}
                            consoleAccess={props.consoleAccess}
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
                {<Redirect to={`${props.match.url}/${defaultUrl}`}/>}
            </Switch>
        );
    };

    const {
        license,
        config,
        environmentConfig,
        showNavigationPrompt,
        roles,
    } = props;
    const {setNavigationBlocked, cancelNavigation, confirmNavigation, editRole, patchConfig} = props.actions;

    if (!props.currentUserHasAnAdminRole) {
        return (
            <Redirect to={props.unauthorizedRoute}/>
        );
    }

    if (!mainRolesLoaded(props.roles)) {
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
        enterpriseReady: props.buildEnterpriseReady,
        license,
        config,
        environmentConfig,
        setNavigationBlocked,
        roles,
        editRole,
        patchConfig,
        cloud: props.cloud,
        isCurrentUserSystemAdmin: props.isCurrentUserSystemAdmin,
    };

    return (
        <>
            <AnnouncementBarController/>
            <SystemNotice/>
            <BackstageNavbar team={props.team}/>
            <AdminSidebar onSearchChange={handleSearchChange}/>
            <div
                className='admin-console__wrapper admin-console'
                id='adminConsoleWrapper'
                ref={handleFocusScroller}
            >
                <SearchKeywordMarking
                    keyword={search}
                    pathname={props.location.pathname}
                >
                    {renderRoutes(extraProps)}
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
};

export default AdminConsole;
