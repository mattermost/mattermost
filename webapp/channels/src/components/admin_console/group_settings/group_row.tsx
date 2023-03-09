// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {FormattedMessage, useIntl} from 'react-intl';

import CheckboxCheckedIcon from 'components/widgets/icons/checkbox_checked_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

type Props = {
    checked: boolean;
    name: string;
    onCheckToggle: (primary_key: string) => void;
    primary_key: string;
    failed?: boolean;
    has_syncables?: boolean;
    mattermost_group_id?: string;
    readOnly?: boolean;
    actions: {
        link: (group_id: string) => void;
        unlink: (group_id: string) => void;
    };
}

const GroupRow = (props: Props) => {
    const [loading, setLoading] = useState(false);
    const {formatMessage} = useIntl();

    const onRowClick = () => {
        if (props.readOnly) {
            return;
        }
        props.onCheckToggle(props.primary_key);
    };

    const linkHandler = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (props.readOnly) {
            return;
        }
        setLoading(true);
        await props.actions.link(props.primary_key);
        setLoading(false);
    };

    const unlinkHandler = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (props.readOnly) {
            return;
        }
        setLoading(true);
        await props.actions.unlink(props.primary_key);
        setLoading(false);
    };

    const renderActions = () => {
        if (!props.mattermost_group_id) {
            return null;
        }
        if (props.has_syncables) {
            return (
                <Link
                    to={'/admin_console/user_management/groups/' + props.mattermost_group_id}
                    id={`${props.name}_edit`}
                >
                    <FormattedMessage
                        id='admin.group_settings.group_row.edit'
                        defaultMessage='Edit'
                    />
                </Link>
            );
        }
        return (
            <Link
                to={'/admin_console/user_management/groups/' + props.mattermost_group_id}
                id={`${props.name}_configure`}
            >
                <FormattedMessage
                    id='admin.group_settings.group_row.configure'
                    defaultMessage='Configure'
                />
            </Link>
        );
    };

    const renderLinked = () => {
        if (loading) {
            return (
                <a href='#'>
                    <LoadingSpinner
                        text={props.mattermost_group_id ?
                            formatMessage({id: 'admin.group_settings.group_row.unlinking', defaultMessage: 'Unlinking'}) :
                            formatMessage({id: 'admin.group_settings.group_row.linking', defaultMessage: 'Linking'})}
                    />
                </a>
            );
        }
        if (props.mattermost_group_id) {
            if (props.failed) {
                return (
                    <a
                        href='#'
                        onClick={unlinkHandler}
                        className='warning'
                    >
                        <i className='icon fa fa-exclamation-triangle'/>
                        <FormattedMessage
                            id='admin.group_settings.group_row.unlink_failed'
                            defaultMessage='Unlink failed'
                        />
                    </a>
                );
            }
            return (
                <a
                    href='#'
                    onClick={unlinkHandler}
                    className={props.readOnly ? 'disabled' : ''}
                >
                    <i className='icon fa fa-link'/>
                    <FormattedMessage
                        id='admin.group_settings.group_row.linked'
                        defaultMessage='Linked'
                    />
                </a>
            );
        }
        if (props.failed) {
            return (
                <a
                    href='#'
                    onClick={linkHandler}
                    className='warning'
                >
                    <i className='icon fa fa-exclamation-triangle'/>
                    <FormattedMessage
                        id='admin.group_settings.group_row.link_failed'
                        defaultMessage='Link failed'
                    />
                </a>
            );
        }
        return (
            <a
                href='#'
                onClick={linkHandler}
                className={props.readOnly ? 'disabled' : ''}
            >
                <i className='icon fa fa-unlink'/>
                <FormattedMessage
                    id='admin.group_settings.group_row.not_linked'
                    defaultMessage='Not Linked'
                />
            </a>
        );
    };

    return (
        <div
            id={`${props.name}_group`}
            className={'group ' + (props.checked ? 'checked' : '')}
            onClick={onRowClick}
        >
            <div className='group-row'>
                <div className='group-name'>
                    <div
                        className={'group-check ' + (props.checked ? 'checked' : '')}
                    >
                        {props.checked && <CheckboxCheckedIcon/>}
                    </div>
                    <span>
                        {props.name}
                    </span>
                </div>
                <div className='group-content'>
                    <span className='group-description'>
                        {renderLinked()}
                    </span>
                    <span className='group-actions'>
                        {renderActions()}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GroupRow;
