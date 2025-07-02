// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './tag_group.scss';

export type TagGroupProps = {

    /**
     * Child elements (typically Tag components)
     */
    children: React.ReactNode;

    /**
     * Optional CSS class name for custom styling
     */
    className?: string;
};

/**
 * A component for grouping and displaying multiple tags
 */
const TagGroup: React.FC<TagGroupProps> = ({
    children,
    className,
}) => {
    return (
        <div className={classNames('TagGroup', className)}>
            {children}
        </div>
    );
};

export default TagGroup;
