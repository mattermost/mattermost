// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import './admin_panel.scss';

type Props = {
    id?: string;
    className?: string;
    onHeaderClick?: React.EventHandler<React.MouseEvent>;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    subtitleValues?: any;
    button?: React.ReactNode;
    children?: React.ReactNode;
};

const AdminPanel: React.FC<Props> = ({
    subtitle,
    title,
    button,
    children,
    className = '',
    id,
    onHeaderClick,
    subtitleValues,
}: Props) => (
    <div
        className={'AdminPanel clearfix ' + className}
        id={id}
    >
        <div
            className='header'
            onClick={onHeaderClick}
        >
            <div>
                <h3>
                    <FormattedMessage
                        {...title}
                    />
                </h3>
                <div className='mt-2'>
                    <FormattedMessage
                        {...subtitle}
                        values={subtitleValues}
                    />
                </div>
            </div>
            {button &&
                <div className='button'>
                    {button}
                </div>
            }
        </div>
        {children}
    </div>
);

export default AdminPanel;
