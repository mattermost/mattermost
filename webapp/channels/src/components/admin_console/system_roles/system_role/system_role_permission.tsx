// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Permissions from 'mattermost-redux/constants/permissions';

import SystemRolePermissionDropdown from './system_role_permission_dropdown';
import {noAccess, writeAccess, readAccess, mixedAccess} from './types';

import type {PermissionsToUpdate, PermissionToUpdate, SystemSection, PermissionAccess} from './types';

import './system_role_permissions.scss';

type Props = {
    readOnly?: boolean;
    setSectionVisible: (name: string, visible: boolean) => void;
    section: SystemSection;
    permissionsMap: Record<string, boolean>;
    visibleSections: Record<string, boolean>;
    permissionsToUpdate: PermissionsToUpdate;
    updatePermissions: (permissions: PermissionToUpdate[]) => void;
}

export default class SystemRolePermission extends React.PureComponent<Props> {
    isSectionVisible = (section: SystemSection, visibleSections: Record<string, boolean>) => {
        const {permissionsMap, permissionsToUpdate} = this.props;
        if (Object.keys(visibleSections).includes(section.name)) {
            return visibleSections[section.name];
        }
        return this.getAccessForSection(section, permissionsMap, permissionsToUpdate) === mixedAccess;
    };

    renderSubsectionToggle = (section: SystemSection, isSectionVisible: boolean) => {
        if (!section.subsections || section.subsections.length === 0) {
            return null;
        }
        const chevron = isSectionVisible ? (<i className='Icon icon-chevron-up'/>) : (<i className='Icon icon-chevron-down'/>);
        const message = isSectionVisible ? (
            <FormattedMessage
                id='admin.permissions.system_role_permissions.hide_subsections'
                defaultMessage='Hide {subsectionsCount} subsections'
                values={{subsectionsCount: section.subsections.length}}
            />
        ) : (
            <FormattedMessage
                id='admin.permissions.system_role_permissions.show_subsections'
                defaultMessage='Show {subsectionsCount} subsections'
                values={{subsectionsCount: section.subsections.length}}
            />
        );
        return (
            <div className='PermissionSubsectionsToggle'>
                <button
                    onClick={() => this.props.setSectionVisible(section.name, !isSectionVisible)}
                    className='dropdown-toggle theme color--link style--none'
                >
                    {message}
                    {chevron}
                </button>
            </div>
        );
    };

    renderSubsections = (section: SystemSection, permissionsMap: Record<string, boolean>, permissionsToUpdate: PermissionsToUpdate, isSectionVisible: boolean) => {
        if (!section.subsections || section.subsections.length === 0) {
            return null;
        }
        return (
            <div>
                {isSectionVisible &&
                    <div className='PermissionSubsections'>
                        {section.subsections.map((subsection) => this.renderSectionRow(subsection, permissionsMap, permissionsToUpdate, isSectionVisible))}
                    </div>
                }
            </div>
        );
    };

    renderSectionRow = (section: SystemSection, permissionsMap: Record<string, boolean>, permissionsToUpdate: PermissionsToUpdate, isSectionVisible: boolean) => {
        return (
            <div
                key={section.name}
                className='PermissionSection'
            >
                <div className='PermissionSectionText'>
                    <div className='PermissionSectionText_title'>
                        <FormattedMessage
                            id={`admin.permissions.sysconsole_section_${section.name}.name`}
                            defaultMessage={section.name}
                        />
                    </div>

                    {section.hasDescription &&
                        <div className='PermissionSection_description'>
                            <FormattedMessage
                                id={`admin.permissions.sysconsole_section_${section.name}.description`}
                                defaultMessage={''}
                            />
                        </div>
                    }

                    {this.renderSubsectionToggle(section, isSectionVisible)}
                </div>
                <div className='PermissionSectionDropdown'>
                    <SystemRolePermissionDropdown
                        section={section}
                        updatePermissions={this.props.updatePermissions}
                        access={this.getAccessForSection(section, permissionsMap, permissionsToUpdate)}
                        isDisabled={this.props.readOnly || Boolean(section.disabled)}
                    />
                </div>
            </div>
        );
    };

    getAccessForSection = (section: SystemSection, permissions: Record<string, boolean>, permissionsToUpdate: Record<string, PermissionAccess>) => {
        // If we have subsections then use them to determine access to show.
        if (section.subsections && section.subsections.length > 0) {
            let hasNoAccess = false;
            let canRead = false;
            let canWrite = false;
            section.subsections.forEach((subsection) => {
                switch (this.getAccessForSectionByName(subsection.name, permissions, permissionsToUpdate)) {
                case readAccess:
                    canRead = true;
                    break;
                case writeAccess:
                    canWrite = true;
                    break;
                default:
                    hasNoAccess = true;
                    break;
                }
            });

            // If the role has more than one type of access across the subsection then mark it as mixed access.
            if ([canRead, canWrite, hasNoAccess].filter((val) => val).length > 1) {
                return mixedAccess;
            } else if (canRead) {
                return readAccess;
            } else if (canWrite) {
                return writeAccess;
            } else if (hasNoAccess) {
                return noAccess;
            }
        }
        return this.getAccessForSectionByName(section.name, permissions, permissionsToUpdate);
    };

    getAccessForSectionByName = (sectionName: string, permissions: Record<string, boolean>, permissionsToUpdate: Record<string, PermissionAccess>) => {
        // Assume sysadmin has write access for everything, this is a bit of a hack but it should be left in until `user_management_read|write_system_roles` is actually a permission
        if (permissions[Permissions.MANAGE_SYSTEM]) {
            return writeAccess;
        }

        let access: PermissionAccess = false;
        if (sectionName in permissionsToUpdate) {
            access = permissionsToUpdate[sectionName];
        } else {
            if (permissions[`sysconsole_read_${sectionName}`] === true) {
                access = readAccess;
            }

            if (permissions[`sysconsole_write_${sectionName}`] === true) {
                access = writeAccess;
            }
        }

        return access;
    };

    render() {
        const {section, permissionsMap, permissionsToUpdate, visibleSections} = this.props;
        const isSectionVisible = this.isSectionVisible(section, visibleSections);
        return (
            <div className='PermissionRow'>
                {this.renderSectionRow(section, permissionsMap, permissionsToUpdate, isSectionVisible)}
                {this.renderSubsections(section, permissionsMap, permissionsToUpdate, isSectionVisible)}
            </div>
        );
    }
}
