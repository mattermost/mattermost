// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {EventHandler, ReactNode, MouseEvent} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import './admin_panel.scss';

type Props = {
    id?: string;
    className?: string;
    onHeaderClick?: EventHandler<MouseEvent>;
    title?: ReactNode;
    subtitle?: ReactNode;
    button?: ReactNode;
    children?: ReactNode;

    /**
     * @deprecated pass title as string or React node
     */
    titleId?: string;

    /**
     * @deprecated pass title as string or React node
     */
    titleDefault?: string;

    /**
     * @deprecated pass substitle as string or React node
     */
    subtitleId?: string;

    /**
     * @deprecated pass substitle as string or React node
     */
    subtitleDefault?: string;

    /**
     * @deprecated pass substitle as string or React node
     */
    subtitleValues?: any;
};

const AdminPanel = (props: Props) => (
    <div
        className={'AdminPanel clearfix ' + props.className}
        id={props.id}
    >
        <div
            className='header'
            onClick={props.onHeaderClick}
        >
            <div>
                <h3>
                    {props.title ? props.title : (
                        <FormattedMessage
                            id={props.titleId}
                            defaultMessage={props.titleDefault}
                        />
                    )}
                </h3>
                <div className='mt-2'>
                    {props.subtitle ? props.subtitle : (
                        <FormattedMessage
                            id={props.subtitleId}
                            defaultMessage={props.subtitleDefault}
                            values={props.subtitleValues}
                        />
                    )}
                </div>
            </div>
            {props.button &&
                <div className='button'>
                    {props.button}
                </div>
            }
        </div>
        {props.children}
    </div>
);

AdminPanel.defaultProps = {
    className: '',
};

export default AdminPanel;
