// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Column, CoreColumn} from '@tanstack/react-table';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {UserReport} from '@mattermost/types/reports';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';
import Tag from 'components/widgets/tag/tag';
import WithTooltip from 'components/with_tooltip';

import {ColumnNames} from '../constants';

import './system_users_column_toggler.scss';

interface Props {
    isMySql: boolean;
    allColumns: Array<Column<UserReport>>;
    visibleColumnsLength: number;
}

export function SystemUsersColumnTogglerMenu(props: Props) {
    const {formatMessage} = useIntl();

    function getColumnName(columnId: CoreColumn<UserReport, unknown>['id']) {
        switch (columnId) {
        case ColumnNames.username:
            return (
                <FormattedMessage
                    id='admin.system_users.list.userDetails'
                    defaultMessage='User details'
                />
            );
        case ColumnNames.email:
            return (
                <FormattedMessage
                    id='admin.system_users.list.email'
                    defaultMessage='Email'
                />
            );
        case ColumnNames.createAt:
            return (
                <FormattedMessage
                    id='admin.system_users.list.memberSince'
                    defaultMessage='Member since'
                />
            );
        case ColumnNames.lastLoginAt:
            return (
                <FormattedMessage
                    id='admin.system_users.list.lastLoginAt'
                    defaultMessage='Last login'
                />
            );
        case ColumnNames.lastStatusAt:
            return (
                <FormattedMessage
                    id='admin.system_users.list.lastActivity'
                    defaultMessage='Last activity'
                />
            );
        case ColumnNames.lastPostDate:
            return (
                <FormattedMessage
                    id='admin.system_users.list.lastPost'
                    defaultMessage='Last post'
                />
            );
        case ColumnNames.daysActive:
            return (
                <FormattedMessage
                    id='admin.system_users.list.daysActive'
                    defaultMessage='Days active'
                />
            );
        case ColumnNames.totalPosts:
            return (
                <FormattedMessage
                    id='admin.system_users.list.totalPosts'
                    defaultMessage='Messages posted'
                />
            );
        case ColumnNames.actions:
            return (
                <FormattedMessage
                    id='admin.system_users.list.actions'
                    defaultMessage='Actions'
                />
            );
        default:
            return <span/>;
        }
    }

    return (
        <div className='systemUsersColumnToggler'>
            <Menu.Container
                menuButton={{
                    id: 'systemUsersColumnTogglerMenuButton',
                    class: 'inputWithMenu',
                    'aria-label': formatMessage({
                        id: 'admin.system_users.column_toggler.menuButtonAriaLabel',
                        defaultMessage:
                            'Open menu to select columns to display',
                    }),
                    as: 'div',
                    children: (
                        <Input
                            label={formatMessage({
                                id: 'admin.system_users.column_toggler.placeholder',
                                defaultMessage: 'Columns',
                            })}
                            name='colXC'
                            value={formatMessage(
                                {
                                    id: 'admin.system_users.column_toggler.menuButtonText',
                                    defaultMessage: '{selectedCount} selected',
                                },
                                {
                                    selectedCount: props.visibleColumnsLength,
                                },
                            )}
                            readOnly={true}
                            inputSuffix={
                                <i className='icon icon-chevron-down'/>
                            }
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
                {props.allColumns.map((column) => {
                    let leadingElement;
                    if (column.getIsVisible()) {
                        leadingElement = (
                            <i className='icon icon-checkbox-marked'/>
                        );
                    } else {
                        leadingElement = (
                            <i className='icon icon-checkbox-blank-outline'/>
                        );
                    }

                    const postStatsColumns: string[] = [ColumnNames.lastPostDate, ColumnNames.daysActive, ColumnNames.totalPosts];
                    if (props.isMySql && postStatsColumns.includes(column.id)) {
                        return (
                            <WithTooltip
                                key={column.id}
                                title={formatMessage({id: 'admin.system_users.column_toggler.mysql_unavailable.title', defaultMessage: 'Not available for servers using MySQL'})}
                                hint={formatMessage({id: 'admin.system_users.column_toggler.mysql_unavailable.desc', defaultMessage: 'Please use the export functionality to view these values'})}
                                isVertical={false}
                            >
                                <Menu.Item
                                    className='systemUsersColumnToggler__lockedItem'
                                    role='menuitemcheckbox'
                                    labels={getColumnName(column.id)}
                                    disabled={true}
                                    leadingElement={leadingElement}
                                    trailingElements={<Tag text={formatMessage({id: 'admin.system_users.column_toggler.mysql_unavailable.label', defaultMessage: 'Not available'})}/>}
                                    onClick={column.getToggleVisibilityHandler()}
                                />
                            </WithTooltip>
                        );
                    }

                    return (
                        <Menu.Item
                            key={column.id}
                            id={column.id}
                            role='menuitemcheckbox'
                            labels={getColumnName(column.id)}
                            disabled={!column.getCanHide()}
                            leadingElement={leadingElement}
                            onClick={column.getToggleVisibilityHandler()}
                        />
                    );
                })}
            </Menu.Container>
        </div>
    );
}
