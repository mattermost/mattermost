// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

import {ColumnNames} from '../constants';

import './system_users_column_toggler.scss';

interface Props {
    selectedColumns: ColumnNames[];
}

function SystemUsersColumnTogglerMenu(props: Props) {
    const {formatMessage} = useIntl();

    function getInputValue(selectedColumns = [] as ColumnNames[]) {
        const DEFAULT_VISIBLE_COLUMNS = 2;

        if (selectedColumns.length === 0) {
            return formatMessage({
                id: 'admin.system_users.column_toggler.inputValue.none',
                defaultMessage: '2 selected',
            });
        }

        const selectedCount = selectedColumns.length + DEFAULT_VISIBLE_COLUMNS;
        return formatMessage(
            {
                id: 'admin.system_users.column_toggler.inputValue',
                defaultMessage: '{selectedCount} selected',
            },
            {selectedCount},
        );
    }

    const columnMenuItems = useMemo(() =>
        Object.values(ColumnNames).map((column) => {
            switch (column) {
            case ColumnNames.displayName:
                return {
                    id: ColumnNames.displayName,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.displayName'
                            defaultMessage='Display Name'
                        />
                    ),
                    selectable: false,
                };
            case ColumnNames.email:
                return {
                    id: ColumnNames.email,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.email'
                            defaultMessage='Email'
                        />
                    ),
                    selectable: true,
                };
            case ColumnNames.createAt:
                return {
                    id: ColumnNames.createAt,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.createAt'
                            defaultMessage='Create At'
                        />
                    ),
                    selectable: true,
                };
            case ColumnNames.lastLoginAt:
                return {
                    id: ColumnNames.lastLoginAt,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.lastLoginAt'
                            defaultMessage='Last Login At'
                        />
                    ),
                    selectable: true,
                };
            case ColumnNames.lastStatusAt:
                return {
                    id: ColumnNames.lastStatusAt,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.lastStatusAt'
                            defaultMessage='Last Status At'
                        />
                    ),
                    selectable: true,
                };
            case ColumnNames.lastPostDate:
                return {
                    id: ColumnNames.lastPostDate,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.lastPostDate'
                            defaultMessage='Last Post Date'
                        />
                    ),
                    selectable: true,
                };
            case ColumnNames.daysActive:
                return {
                    id: ColumnNames.daysActive,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.daysActive'
                            defaultMessage='Days Active'
                        />
                    ),
                    selectable: true,
                };
            case ColumnNames.totalPosts:
                return {
                    id: ColumnNames.totalPosts,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.totalPosts'
                            defaultMessage='Total Posts'
                        />
                    ),
                    selectable: true,
                };
            case ColumnNames.actions:
                return {
                    id: ColumnNames.actions,
                    label: (
                        <FormattedMessage
                            id='admin.system_users.column_toggler.column.actions'
                            defaultMessage='Actions'
                        />
                    ),
                    selectable: false,
                };
            default:
                return null;
            }
        }),
    [],
    );

    return (
        <div className='systemUsersColumnToggler'>
            <Menu.Container
                menuButton={{
                    id: 'systemUsersColumnTogglerMenuButton',
                    class: 'inputWithMenu',
                    'aria-label': formatMessage({
                        id: 'admin.system_users.column_toggler.menuButtonAriaLabel',
                        defaultMessage: 'Open menu to select columns to display',
                    }),
                    as: 'div',
                    children: (
                        <Input
                            label={formatMessage({
                                id: 'admin.system_users.column_toggler.placeholder',
                                defaultMessage: 'Columns',
                            })}
                            name='colXC'
                            value={getInputValue(props.selectedColumns)}
                            readOnly={true}
                            inputSuffix={<i className='icon icon-chevron-down'/>}
                        />
                    ),
                }}
                menu={{
                    id: 'systemUsersColumnTogglerMenu',
                    'aria-label': formatMessage({
                        id: 'admin.system_users.column_toggler.dropdownAriaLabel',
                        defaultMessage: 'Columns visibility menu',
                    }),
                }}
            >
                {columnMenuItems.map((item) => {
                    if (item) {
                        let leadingElement;
                        if (item.selectable) {
                            if (props.selectedColumns.includes(item.id)) {
                                leadingElement = <i className='icon icon-checkbox-marked'/>;
                            } else {
                                leadingElement = <i className='icon icon-checkbox-blank-outline'/>;
                            }
                        } else {
                            // This means the column is always visible
                            leadingElement = <i className='icon icon-checkbox-marked'/>;
                        }

                        return (
                            <Menu.Item
                                key={item.label.props.id}
                                id={item.label.props.id}
                                labels={item.label}
                                disabled={!item.selectable}
                                leadingElement={leadingElement}
                                antipattern__blockClosingOnClick={true}

                                // onClick={this.handleColumnMenuItemActivated}
                            />
                        );
                    }

                    return null;
                })}
            </Menu.Container>
        </div>
    );
}

export default SystemUsersColumnTogglerMenu;
