// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import classNames from 'classnames';

import AdminPanel from './admin_panel';

type Props = {
    children?: React.ReactNode;
    className: string;
    id?: string;
    titleId: string;
    titleDefault: string;
    subtitleId: string;
    subtitleDefault: string;
    subtitleValues?: any;
    url: string;
    disabled?: boolean;
    linkTextId: string;
    linkTextDefault: string;
}

const AdminPanelWithLink = (props: Props) => {
    const button = (
        <Link
            data-testid={`${props.id}-link`}
            className={classNames(['btn', 'btn-primary', {disabled: props.disabled}])}
            to={props.url}
            onClick={props.disabled ? (e) => e.preventDefault() : () => null}
        >
            <FormattedMessage
                id={props.linkTextId}
                defaultMessage={props.linkTextDefault}
            />
        </Link>
    );

    return (
        <AdminPanel
            className={'AdminPanelWithLink ' + props.className}
            id={props.id}
            data-testid={props.id}
            titleId={props.titleId}
            titleDefault={props.titleDefault}
            subtitleId={props.subtitleId}
            subtitleDefault={props.subtitleDefault}
            subtitleValues={props.subtitleValues}
            button={button}
        >
            {props.children}
        </AdminPanel>
    );
};

AdminPanelWithLink.defaultProps = {
    className: '',
};

export default AdminPanelWithLink;
