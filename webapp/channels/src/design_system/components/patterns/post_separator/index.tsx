// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classnames from 'classnames';
import React, {memo} from 'react';

import './index.scss';

type Props = {
    className?: string;
    testId?: string;
    children?: React.ReactNode;
};

const PostSeparator = (props: Props) => {
    return (
        <div
            className={classnames('Separator', props.className)}
            data-testid={props.testId}
        >
            <hr className='separator__hr'/>
            {props.children && (
                <div className='separator__text'>
                    {props.children}
                </div>
            )}
        </div>
    );
};

export default memo(PostSeparator);
