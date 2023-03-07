// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import {PermissionsScope} from 'utils/constants';

import {Role} from '@mattermost/types/roles';

import PermissionCheckbox from './permission_checkbox';
import PermissionRow from './permission_row';
import PermissionDescription from './permission_description';
import {AdditionalValues, Permission, Permissions} from './permissions_tree/types';

type Props = {
    id: string;
    uniqId?: string;
    permissions: Permissions;
    onChange: (ids: string[]) => void;
    scope: string;
    readOnly?: boolean;
    role?: Partial<Role>;
    parentRole?: Partial<Role>;
    combined?: boolean;
    selected?: string;
    selectRow: (id: string) => void;
    root?: boolean;
    additionalValues?: AdditionalValues;
};

type State = {
    expanded: boolean;
    prevPermissions: Permissions;
    selected: string | undefined;
};

const getRecursivePermissions = (permissions: Permissions): string[] => {
    let result: string[] = [];
    for (const permission of permissions) {
        if (typeof permission === 'string') {
            result.push(permission);
        } else {
            result = result.concat(getRecursivePermissions(permission.permissions));
        }
    }
    return result;
};

export default class PermissionGroup extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            expanded: true,
            prevPermissions: [],
            selected: props.selected,
        };
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (props.selected !== state.selected) {
            if (getRecursivePermissions(props.permissions).indexOf(props.selected ? props.selected : '') !== -1) {
                return {expanded: true, selected: props.selected};
            }
            return {selected: props.selected};
        }
        return null;
    }

    toggleExpanded = (e: MouseEvent) => {
        e.stopPropagation();
        this.setState({expanded: !this.state.expanded});
    }

    toggleSelectRow = (id: string) => {
        if (this.props.readOnly) {
            return;
        }
        this.props.onChange([id]);
    }

    toggleSelectSubGroup = (ids: string[]) => {
        if (this.props.readOnly) {
            return;
        }
        this.props.onChange(ids);
    }

    toggleSelectGroup = () => {
        const {readOnly, permissions, role, onChange} = this.props;
        if (readOnly || !role) {
            return;
        }
        if (this.getStatus(permissions) === 'checked') {
            const permissionsToToggle: string[] = [];
            for (const permission of getRecursivePermissions(permissions)) {
                if (!this.fromParent(permission)) {
                    permissionsToToggle.push(permission);
                }
            }
            this.setState({expanded: true});
            onChange(permissionsToToggle);
        } else if (this.getStatus(permissions) === '') {
            const permissionsToToggle = [];
            let expanded = true;
            if (this.state.prevPermissions.length === 0) {
                for (const permission of getRecursivePermissions(permissions)) {
                    if (!this.fromParent(permission)) {
                        permissionsToToggle.push(permission);
                        expanded = false;
                    }
                }
            } else {
                for (const permission of getRecursivePermissions(permissions)) {
                    if (this.state.prevPermissions.indexOf(permission) !== -1 && !this.fromParent(permission)) {
                        permissionsToToggle.push(permission);
                    }
                }
            }
            onChange(permissionsToToggle);
            this.setState({prevPermissions: [], expanded});
        } else {
            const permissionsToToggle = [];
            for (const permission of getRecursivePermissions(permissions)) {
                if (role.permissions?.indexOf(permission) === -1 && !this.fromParent(permission)) {
                    permissionsToToggle.push(permission);
                }
            }
            this.setState({prevPermissions: role.permissions || [], expanded: false});
            onChange(permissionsToToggle);
        }
    }

    isInScope = (permission: string) => {
        if (this.props.scope === 'channel_scope' && PermissionsScope[permission] !== 'channel_scope') {
            return false;
        }
        if (this.props.scope === 'team_scope' && PermissionsScope[permission] === 'system_scope') {
            return false;
        }
        return true;
    }

    renderPermission = (permission: string, additionalValues: AdditionalValues) => {
        if (!this.isInScope(permission)) {
            return null;
        }
        const comesFromParent = this.fromParent(permission);
        const active = comesFromParent || this.props.role?.permissions?.indexOf(permission) !== -1;
        const inherited = comesFromParent ? this.props.parentRole : undefined;
        return (
            <PermissionRow
                key={permission}
                id={permission}
                uniqId={this.props.uniqId + '-' + permission}
                selected={this.props.selected}
                selectRow={this.props.selectRow}
                readOnly={this.props.readOnly || comesFromParent}
                inherited={inherited}
                value={active ? 'checked' : ''}
                onChange={this.toggleSelectRow}
                additionalValues={additionalValues}
            />
        );
    }

    renderGroup = (g: Permission) => {
        return (
            <PermissionGroup
                key={g.id}
                id={g.id}
                uniqId={this.props.uniqId + '-' + g.id}
                selected={this.props.selected}
                selectRow={this.props.selectRow}
                readOnly={this.props.readOnly}
                permissions={g.permissions}
                additionalValues={this.props.additionalValues}
                role={this.props.role}
                parentRole={this.props.parentRole}
                scope={this.props.scope}
                onChange={this.toggleSelectSubGroup}
                combined={g.combined}
                root={false}
            />
        );
    }

    fromParent = (id: string) => {
        return this.props.parentRole && this.props.parentRole.permissions?.indexOf(id) !== -1;
    }

    getStatus = (permissions: Permissions) => {
        let anyChecked = false;
        let anyUnchecked = false;
        for (const permission of permissions) {
            if (typeof permission === 'string') {
                if (!this.isInScope(permission)) {
                    continue;
                }
                anyChecked = anyChecked || this.fromParent(permission) || this.props.role?.permissions?.indexOf(permission) !== -1;
                anyUnchecked = anyUnchecked || (!this.fromParent(permission) && this.props.role?.permissions?.indexOf(permission) === -1);
            } else {
                const status = this.getStatus(permission.permissions);
                if (status === 'intermediate') {
                    return 'intermediate';
                }
                if (status === 'checked') {
                    anyChecked = true;
                }
                if (status === '') {
                    anyUnchecked = true;
                }
            }
        }
        if (anyChecked && anyUnchecked) {
            return 'intermediate';
        }
        if (anyChecked && !anyUnchecked) {
            return 'checked';
        }
        return '';
    }

    hasPermissionsOnScope = () => {
        return getRecursivePermissions(this.props.permissions).some((permission) => this.isInScope(permission));
    }

    allPermissionsFromParent = (permissions: Permissions) => {
        for (const permission of permissions) {
            if (typeof permission !== 'string') {
                if (!this.allPermissionsFromParent(permission.permissions)) {
                    return false;
                }
                continue;
            }
            if (this.isInScope(permission) && !this.fromParent(permission)) {
                return false;
            }
        }
        return true;
    }

    render = () => {
        const {id, uniqId, permissions, readOnly, combined, root, selected, additionalValues} = this.props;
        if (!this.hasPermissionsOnScope()) {
            return null;
        }
        const permissionsRows = permissions.map((group) => {
            if (typeof group === 'string') {
                const addVals = additionalValues && additionalValues[group] ? additionalValues[group] : {};
                return this.renderPermission(group, addVals);
            }
            return this.renderGroup(group as Permission);
        });
        if (root) {
            return (
                <div className={'permission-group-permissions ' + (this.state.expanded ? 'open' : '')}>
                    {permissionsRows}
                </div>
            );
        }

        let inherited;
        if (this.allPermissionsFromParent(this.props.permissions) && this.props.combined) {
            inherited = this.props.parentRole;
        }

        let classes = '';
        if (selected === id) {
            classes += ' selected';
        }

        if (readOnly || this.allPermissionsFromParent(this.props.permissions)) {
            classes += ' read-only';
        }

        if (combined) {
            classes += ' combined';
        }
        const additionalValuesProp = additionalValues?.[id] ? additionalValues[id] : undefined;

        return (
            <div className='permission-group'>
                {!root &&
                    <div
                        className={'permission-group-row ' + classes}
                        onClick={this.toggleSelectGroup}
                        id={uniqId}
                    >
                        {!combined &&
                            <div
                                className={'fa fa-caret-right permission-arrow ' + (this.state.expanded ? 'open' : '')}
                                onClick={this.toggleExpanded}
                            />}
                        <PermissionCheckbox
                            value={this.getStatus(this.props.permissions)}
                            id={`${uniqId}-checkbox`}
                        />
                        <span className='permission-name'>
                            <FormattedMessage id={'admin.permissions.group.' + id + '.name'}/>
                        </span>
                        <PermissionDescription
                            additionalValues={additionalValuesProp}
                            inherited={inherited}
                            id={id}
                            selectRow={this.props.selectRow}
                            rowType='group'
                        />
                    </div>}
                {!combined &&
                    <div className={'permission-group-permissions ' + (this.state.expanded ? 'open' : '')}>
                        {permissionsRows}
                    </div>}
            </div>
        );
    };
}
