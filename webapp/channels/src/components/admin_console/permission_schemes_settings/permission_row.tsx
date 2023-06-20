// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Role} from '@mattermost/types/roles';

import PermissionCheckbox from './permission_checkbox';
import PermissionDescription from './permission_description';
import {AdditionalValues} from './permissions_tree/types';

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

const PermissionRow = (props: Props): JSX.Element => {
    const toggleSelect = (): void => {
        if (props.readOnly) {
            return;
        }
        props.onChange(props.id);
    };

    const {id, uniqId, inherited, value, readOnly, selected, additionalValues} = props;
    let classes = 'permission-row';
    if (readOnly) {
        classes += ' read-only';
    }

    if (selected === id) {
        classes += ' selected';
    }

    return (
        <div
            className={classes}
            onClick={toggleSelect}
            id={uniqId}
        >
            <PermissionCheckbox
                value={value}
                id={`${uniqId}-checkbox`}
            />
            <span className='permission-name'>
                <FormattedMessage
                    id={'admin.permissions.permission.' + id + '.name'}
                />
            </span>
            <PermissionDescription
                inherited={inherited}
                id={id}
                selectRow={props.selectRow}
                rowType='permission'
                additionalValues={additionalValues}
            />
        </div>
    );
};

export default PermissionRow;
