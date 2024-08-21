// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Role} from '@mattermost/types/roles';

import PermissionCheckbox from './permission_checkbox';
import PermissionDescription from './permission_description';
import type {AdditionalValues} from './permissions_tree/types';
import {permissionRolesStrings} from './strings/permissions';

type Props = {
    id: string;
    uniqId: string;
    inherited?: Partial<Role>;
    readOnly?: boolean;
    selected?: string;
    selectRow: (id: string) => void;
    value: string;
    onChange: (id: string) => void;
    additionalValues: AdditionalValues;
}

const PermissionRow = ({
    additionalValues,
    id,
    onChange,
    selectRow,
    uniqId,
    value,
    inherited,
    readOnly,
    selected,
}: Props) => {
    const toggleSelect = useCallback(() => {
        if (readOnly) {
            return;
        }
        onChange(id);
    }, [readOnly, onChange, id]);

    const name = permissionRolesStrings[id] ? <FormattedMessage {...permissionRolesStrings[id].name}/> : id;
    let description: React.JSX.Element | string = '';
    if (permissionRolesStrings[id]) {
        description = (
            <FormattedMessage
                id={permissionRolesStrings[id].description.id}
                values={additionalValues}
            />
        );
    }

    return (
        <div
            className={classNames('permission-row', {'read-only': readOnly, selected: selected === id})}
            onClick={toggleSelect}
            id={uniqId}
        >
            <PermissionCheckbox
                value={value}
                id={`${uniqId}-checkbox`}
            />
            <span className='permission-name'>
                {name}
            </span>
            <PermissionDescription
                inherited={inherited}
                id={id}
                selectRow={selectRow}
                description={description}
                additionalValues={additionalValues}
            />
        </div>
    );
};

export default PermissionRow;
