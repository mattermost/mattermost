// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './page_body.scss';

type Props = {
    children: React.ReactNode | readonly React.ReactNode[];
};

export default function PageBody(props: Props) {
    return (
        <div className='PreparingWorkspacePageBody'>
            {props.children}
        </div>
    );
}

