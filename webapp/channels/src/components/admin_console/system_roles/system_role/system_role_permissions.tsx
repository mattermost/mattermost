// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Role} from '@mattermost/types/roles';

import {memoizeResult} from 'mattermost-redux/utils/helpers';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import Constants from 'utils/constants';
import {t} from 'utils/i18n';

import SystemRolePermission from './system_role_permission';
import type {PermissionsToUpdate, PermissionToUpdate, SystemSection} from './types';

import './system_role_permissions.scss';

type Props = {
    role: Role;
    permissionsToUpdate: PermissionsToUpdate;
    updatePermissions: (permissions: PermissionToUpdate[]) => void;
    readOnly?: boolean;
    isLicensedForCloud: boolean;
}

type State = {
    visibleSections: Record<string, boolean>;
}

// the actual permissions correlating to these values are of the format `sysconsole_(read|write)_name(.subsection.name)`
const sectionsList: SystemSection[] = [
    {
        name: 'about',
        hasDescription: true,
        subsections: [
            {name: 'about_edition_and_license'},
        ],
    },
    {
        name: 'billing',
        hasDescription: true,
        subsections: [],
    },
    {
        name: 'reporting',
        hasDescription: true,
        subsections: [
            {name: 'reporting_site_statistics'},
            {name: 'reporting_team_statistics'},
            {name: 'reporting_server_logs'},
        ],
    },
    {
        name: 'user_management',
        hasDescription: true,
        subsections: [
            {name: 'user_management_users', hasDescription: true},
            {name: 'user_management_groups'},
            {name: 'user_management_teams'},
            {name: 'user_management_channels'},
            {name: 'user_management_permissions'},
            {name: 'user_management_system_roles', disabled: true},
        ],
    },
    {
        name: 'environment',
        hasDescription: true,
        subsections: [
            {name: 'environment_web_server'},
            {name: 'environment_database'},
            {name: 'environment_elasticsearch'},
            {name: 'environment_file_storage'},
            {name: 'environment_image_proxy'},
            {name: 'environment_smtp'},
            {name: 'environment_push_notification_server'},
            {name: 'environment_high_availability'},
            {name: 'environment_rate_limiting'},
            {name: 'environment_logging'},
            {name: 'environment_session_lengths'},
            {name: 'environment_performance_monitoring'},
            {name: 'environment_developer'},
        ],
    },
    {
        name: 'site',
        hasDescription: true,
        subsections: [
            {name: 'site_customization'},
            {name: 'site_localization'},
            {name: 'site_users_and_teams'},
            {name: 'site_notifications'},
            {name: 'site_announcement_banner'},
            {name: 'site_emoji'},
            {name: 'site_posts'},
            {name: 'site_file_sharing_and_downloads'},
            {name: 'site_public_links'},
            {name: 'site_notices'},
        ],
    },
    {
        name: 'authentication',
        hasDescription: true,
        subsections: [
            {name: 'authentication_signup'},
            {name: 'authentication_email'},
            {name: 'authentication_password'},
            {name: 'authentication_mfa'},
            {name: 'authentication_ldap'},
            {name: 'authentication_saml'},
            {name: 'authentication_openid'},
            {name: 'authentication_guest_access'},
        ],
    },
    {
        name: 'plugins',
        hasDescription: true,
        subsections: [],
    },
    {
        name: 'integrations',
        hasDescription: true,
        subsections: [
            {name: 'integrations_integration_management'},
            {name: 'integrations_bot_accounts'},
            {name: 'integrations_gif'},
            {name: 'integrations_cors'},
        ],
    },
    {
        name: 'compliance',
        hasDescription: true,
        subsections: [
            {name: 'compliance_data_retention_policy'},
            {name: 'compliance_compliance_export'},
            {name: 'compliance_compliance_monitoring'},
            {name: 'compliance_custom_terms_of_service'},
        ],
    },
    {
        name: 'experimental',
        hasDescription: true,
        subsections: [
            {name: 'experimental_features'},
            {name: 'experimental_feature_flags'},
            {name: 'experimental_bleve'},
        ],
    },
];

const SECTIONS_BY_ROLES: Record<string, Record<string, boolean>> = {
    [Constants.PERMISSIONS_SYSTEM_USER_MANAGER]: {
        user_management: true,
        authentication: true,
    },
};

const getPermissionsMap = memoizeResult((permissions: string[]) => {
    return permissions.reduce((permissionsMap, permission) => {
        permissionsMap[permission] = true;
        return permissionsMap;
    }, {} as Record<string, boolean>);
});

const getSectionsListForRole = memoizeResult((sections: SystemSection[], roleName: string, sectionsByRole: Record<string, Record<string, boolean>>) => {
    return sections.filter((section) => (!sectionsByRole[roleName] || sectionsByRole[roleName][section.name]));
});

export default class SystemRolePermissions extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            visibleSections: {},
        };
    }

    removeSection = (name: string) => {
        const sectionIndex = sectionsList.findIndex((section) => section.name === name);
        if (sectionIndex > -1) {
            sectionsList.splice(sectionIndex, 1);
        }
    };

    updatePermissions = (permissions: PermissionToUpdate[]) => {
        this.props.updatePermissions(permissions);
    };

    setSectionVisible = (name: string, visible: boolean) => {
        const {visibleSections} = this.state;
        this.setState({
            visibleSections: {
                ...visibleSections,
                [name]: visible,
            },
        });
    };

    getRows = (permissionsMap: Record<string, boolean>, permissionsToUpdate: PermissionsToUpdate, visibleSections: Record<string, boolean>) => {
        const {isLicensedForCloud} = this.props;
        let editedSectionsByRole = {
            ...SECTIONS_BY_ROLES,
        };

        if (this.props.role.name === Constants.PERMISSIONS_SYSTEM_CUSTOM_GROUP_ADMIN) {
            return (
                <FormattedMarkdownMessage
                    id='admin.permissions.roles.system_custom_group_admin.detail_text'
                    defaultMessage="The built-in Custom Group Manager role can be used to delegate the administration of [Custom Groups](https://docs.mattermost.com/welcome/manage-custom-groups.html) to users other than the System Admin.\n \nDon't forget to deauthorize all other system users from administering Custom Groups by unchecking the associated permissions checkbox in System console > User Management > Permissions.\n \nThis role has permission to create, edit, and delete custom user groups by selecting **User groups** from the Products menu."
                />
            );
        }

        if (this.props.role.name === Constants.PERMISSIONS_SYSTEM_USER_MANAGER) {
            let permissionsToShow: Record<string, boolean> = {};
            Object.keys(permissionsMap).forEach((permission) => {
                if (permission.startsWith('sysconsole_')) {
                    const permissionShortName = permission.replace(/sysconsole_(read|write)_/, '');
                    permissionsToShow = {
                        ...permissionsToShow,
                        [permissionShortName]: true,
                    };
                }
            });

            editedSectionsByRole = {
                [Constants.PERMISSIONS_SYSTEM_USER_MANAGER]: {
                    ...editedSectionsByRole[Constants.PERMISSIONS_SYSTEM_USER_MANAGER],
                    ...permissionsToShow,
                },
            };
        }

        if (!isLicensedForCloud) {
            // Remove the billing section if it's not licensed for cloud
            this.removeSection('billing');
        }

        if (isLicensedForCloud) {
            // Remove the site configuration section if it's licensed for cloud
            this.removeSection('about');
            this.removeSection('environment');
        }

        return getSectionsListForRole(sectionsList, this.props.role.name, editedSectionsByRole).map((section: SystemSection) => {
            return (
                <SystemRolePermission
                    key={section.name}
                    section={section}
                    permissionsMap={permissionsMap}
                    permissionsToUpdate={permissionsToUpdate}
                    visibleSections={visibleSections}
                    setSectionVisible={this.setSectionVisible}
                    updatePermissions={this.props.updatePermissions}
                    readOnly={this.props.readOnly}
                />
            );
        });
    };

    render() {
        const {role, permissionsToUpdate} = this.props;
        const {visibleSections} = this.state;
        const permissionsMap = getPermissionsMap(role.permissions);
        return (
            <AdminPanel
                id='SystemRolePermissions'
                titleId={t('admin.permissions.system_role_permissions.title')}
                titleDefault='Privileges'
                subtitleId={t('admin.permissions.system_role_permissions.description')}
                subtitleDefault='Level of access to the system console.'
            >
                <div className='SystemRolePermissions'>
                    {this.getRows(permissionsMap, permissionsToUpdate, visibleSections)}
                </div>
            </AdminPanel>
        );
    }
}

t('admin.permissions.sysconsole_section_about.name');
t('admin.permissions.sysconsole_section_about.description');
t('admin.permissions.sysconsole_section_about_edition_and_license.name');
t('admin.permissions.sysconsole_section_billing.name');
t('admin.permissions.sysconsole_section_billing.description');
t('admin.permissions.sysconsole_section_reporting.name');
t('admin.permissions.sysconsole_section_reporting.description');
t('admin.permissions.sysconsole_section_reporting_site_statistics.name');
t('admin.permissions.sysconsole_section_reporting_team_statistics.name');
t('admin.permissions.sysconsole_section_reporting_server_logs.name');
t('admin.permissions.sysconsole_section_user_management.name');
t('admin.permissions.sysconsole_section_user_management.description');
t('admin.permissions.sysconsole_section_user_management_users.name');
t('admin.permissions.sysconsole_section_user_management_users.description');
t('admin.permissions.sysconsole_section_user_management_groups.name');
t('admin.permissions.sysconsole_section_user_management_teams.name');
t('admin.permissions.sysconsole_section_user_management_channels.name');
t('admin.permissions.sysconsole_section_user_management_permissions.name');
t('admin.permissions.sysconsole_section_user_management_system_roles.name');
t('admin.permissions.sysconsole_section_environment.name');
t('admin.permissions.sysconsole_section_environment.description');
t('admin.permissions.sysconsole_section_environment_web_server.name');
t('admin.permissions.sysconsole_section_environment_database.name');
t('admin.permissions.sysconsole_section_environment_elasticsearch.name');
t('admin.permissions.sysconsole_section_environment_file_storage.name');
t('admin.permissions.sysconsole_section_environment_image_proxy.name');
t('admin.permissions.sysconsole_section_environment_smtp.name');
t('admin.permissions.sysconsole_section_environment_push_notification_server.name');
t('admin.permissions.sysconsole_section_environment_high_availability.name');
t('admin.permissions.sysconsole_section_environment_rate_limiting.name');
t('admin.permissions.sysconsole_section_environment_logging.name');
t('admin.permissions.sysconsole_section_environment_session_lengths.name');
t('admin.permissions.sysconsole_section_environment_performance_monitoring.name');
t('admin.permissions.sysconsole_section_environment_developer.name');
t('admin.permissions.sysconsole_section_site.name');
t('admin.permissions.sysconsole_section_site.description');
t('admin.permissions.sysconsole_section_site_customization.name');
t('admin.permissions.sysconsole_section_site_localization.name');
t('admin.permissions.sysconsole_section_site_users_and_teams.name');
t('admin.permissions.sysconsole_section_site_notifications.name');
t('admin.permissions.sysconsole_section_site_announcement_banner.name');
t('admin.permissions.sysconsole_section_site_emoji.name');
t('admin.permissions.sysconsole_section_site_posts.name');
t('admin.permissions.sysconsole_section_site_file_sharing_and_downloads.name');
t('admin.permissions.sysconsole_section_site_public_links.name');
t('admin.permissions.sysconsole_section_site_notices.name');
t('admin.permissions.sysconsole_section_authentication.name');
t('admin.permissions.sysconsole_section_authentication.description');
t('admin.permissions.sysconsole_section_authentication_signup.name');
t('admin.permissions.sysconsole_section_authentication_email.name');
t('admin.permissions.sysconsole_section_authentication_password.name');
t('admin.permissions.sysconsole_section_authentication_mfa.name');
t('admin.permissions.sysconsole_section_authentication_ldap.name');
t('admin.permissions.sysconsole_section_authentication_saml.name');
t('admin.permissions.sysconsole_section_authentication_openid.name');
t('admin.permissions.sysconsole_section_authentication_guest_access.name');
t('admin.permissions.sysconsole_section_plugins.name');
t('admin.permissions.sysconsole_section_plugins.description');
t('admin.permissions.sysconsole_section_integrations.name');
t('admin.permissions.sysconsole_section_integrations.description');
t('admin.permissions.sysconsole_section_integrations_integration_management.name');
t('admin.permissions.sysconsole_section_integrations_bot_accounts.name');
t('admin.permissions.sysconsole_section_integrations_gif.name');
t('admin.permissions.sysconsole_section_integrations_cors.name');
t('admin.permissions.sysconsole_section_compliance.name');
t('admin.permissions.sysconsole_section_compliance.description');
t('admin.permissions.sysconsole_section_compliance_data_retention_policy.name');
t('admin.permissions.sysconsole_section_compliance_compliance_export.name');
t('admin.permissions.sysconsole_section_compliance_compliance_monitoring.name');
t('admin.permissions.sysconsole_section_compliance_custom_terms_of_service.name');
t('admin.permissions.sysconsole_section_experimental.name');
t('admin.permissions.sysconsole_section_experimental.description');
t('admin.permissions.sysconsole_section_experimental_features.name');
t('admin.permissions.sysconsole_section_experimental_feature_flags.name');
t('admin.permissions.sysconsole_section_experimental_bleve.name');
