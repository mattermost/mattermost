// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

type Props = {
    children: React.ReactNode;
    expanded?: boolean;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
};

const CardHeader: React.FC<Props> = (props: Props) => {
    return (
        <div
            className={classNames('Card__header', {expanded: props.expanded})}
            onClick={props.onClick}
        >
            {props.children}
            {props.expanded && <hr className='Card__hr'/>}
        </div>
    );
};

export default CardHeader;
