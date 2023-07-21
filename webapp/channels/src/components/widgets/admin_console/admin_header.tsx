// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {ReactNode} from 'react';

type Props = {
    withBackButton?: boolean;
    children: ReactNode;
};

const AdminHeader = (props: Props) => {
    return (
        <div
            className={
                classNames(
                    'admin-console__header',
                    {'with-back': props.withBackButton},
                )
            }
        >
            {props.children}
        </div>
    );
};

export default AdminHeader;
