// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './description.scss';

type Props = {
    children: React.ReactNode | React.ReactNodeArray;
}

const Description = (props: Props) => {
    return (<p className='PreparingWorkspaceDescription'>
        {props.children}
    </p>);
};

export default Description;
