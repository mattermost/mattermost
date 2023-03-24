// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';

import './admin_button_outline.scss';

type Props = {
    onClick: any;
    children?: string;
    disabled?: boolean;
    className?: string;
}

const AdminButtonOutline: React.FC<Props> = (props: Props) => {
    return (
        <button
            type='button'
            onClick={props.onClick}
            className={classNames('AdminButtonOutline', 'btn', props.className)}
            disabled={props.disabled}
        >
            {props.children}
        </button>
    );
};

export default AdminButtonOutline;

