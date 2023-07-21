// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import DropdownIcon from 'components/widgets/icons/fa_dropdown_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import * as Utils from 'utils/utils';

import {noAccess, PermissionAccess, writeAccess, readAccess, PermissionToUpdate, SystemSection, mixedAccess, WriteAccess, NoAccess, ReadAccess, MixedAccess} from './types';

import './system_role_permissions.scss';

type Props = {
    section: SystemSection;
    access: MixedAccess | ReadAccess | NoAccess | WriteAccess;
    updatePermissions: (permissions: PermissionToUpdate[]) => void;
    isDisabled?: boolean;
}

export default class SystemRolePermissionDropdown extends React.PureComponent<Props> {
    updatePermission = (value: PermissionAccess) => {
        const {section} = this.props;
        const permissions: PermissionToUpdate[] = [];
        if (section.subsections && section.subsections.length > 0) {
            section.subsections.forEach(({name, disabled}) => {
                if (!disabled) {
                    permissions.push({name, value});
                }
            });
        } else {
            permissions.push({name: section.name, value});
        }
        this.props.updatePermissions(permissions);
    };

    renderOption = (label: JSX.Element, description: JSX.Element) => {
        return (
            <div className='PermissionSectionDropdownOptions'>
                <div className='PermissionSectionDropdownOptions_label'>
                    {label}
                </div>
                <div className='PermissionSectionDropdownOptions_description'>
                    {description}
                </div>
            </div>
        );
    };

    render() {
        const {isDisabled, section} = this.props;

        const canWriteLabel = (
            <FormattedMessage
                id={'admin.permissions.system_role_permissions.write.title'}
                defaultMessage='Can edit'
            />
        );

        const canWriteDescription = (
            <FormattedMessage
                id={'admin.permissions.system_role_permissions.write.description'}
                defaultMessage='Can add, edit and delete anything in this section.'
            />
        );

        const canReadLabel = (
            <FormattedMessage
                id={'admin.permissions.system_role_permissions.read.title'}
                defaultMessage='Read only'
            />
        );
        const canReadDescription = (
            <FormattedMessage
                id={'admin.permissions.system_role_permissions.read.description'}
                defaultMessage={'Can view this section but can\'t edit anything in it'}
            />
        );

        const noAccessLabel = (
            <FormattedMessage
                id={'admin.permissions.system_role_permissions.no_access.title'}
                defaultMessage='No access'
            />
        );

        const mixedAccessLabel = (
            <FormattedMessage
                id={'admin.permissions.system_role_permissions.mixed_access.title'}
                defaultMessage='Mixed access'
            />
        );

        const noAccessDescription = (
            <FormattedMessage
                id={'admin.permissions.system_role_permissions.no_access.description'}
                defaultMessage={'No access to this section and it will be hidden in the navigation.'}
            />
        );

        let currentAccess = noAccessLabel;
        switch (this.props.access) {
        case readAccess:
            currentAccess = canReadLabel;
            break;
        case writeAccess:
            currentAccess = canWriteLabel;
            break;
        case mixedAccess:
            currentAccess = mixedAccessLabel;
            break;
        default:
            currentAccess = noAccessLabel;
            break;
        }

        const ariaLabel = Utils.localizeMessage('admin.permissions.system_role_permissions.change_access', 'Change role access on a system console section');
        return (
            <MenuWrapper
                isDisabled={isDisabled}
            >
                <button
                    id={`systemRolePermissionDropdown${section.name}`}
                    className='PermissionSectionDropdownButton dropdown-toggle theme'
                    type='button'
                    aria-expanded='true'
                >
                    <div className='PermissionSectionDropdownButton_text'>
                        {currentAccess}
                    </div>
                    <div className='PermissionSectionDropdownButton_icon'>
                        <DropdownIcon/>
                    </div>
                </button>
                <Menu ariaLabel={ariaLabel}>
                    <Menu.ItemAction
                        onClick={() => this.updatePermission(writeAccess)}
                        text={this.renderOption(canWriteLabel, canWriteDescription)}
                    />
                    <Menu.ItemAction
                        onClick={() => this.updatePermission(readAccess)}
                        text={this.renderOption(canReadLabel, canReadDescription)}
                    />
                    <Menu.ItemAction
                        onClick={() => this.updatePermission(noAccess)}
                        text={this.renderOption(noAccessLabel, noAccessDescription)}
                    />
                </Menu>
            </MenuWrapper>
        );
    }
}
