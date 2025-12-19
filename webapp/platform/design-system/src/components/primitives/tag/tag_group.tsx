// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import type {ReactNode} from 'react';

import './tag.scss';

export interface TagGroupProps {

    /** Child elements (typically Tag components) */
    children: ReactNode;

    /** Optional CSS class name for custom styling */
    className?: string;

    /** Test ID for testing purposes */
    testId?: string;
}

/**
 * A component for grouping and displaying multiple tags with consistent spacing.
 *
 * @example
 * <TagGroup>
 *   <Tag preset="beta" />
 *   <Tag preset="bot" />
 *   <Tag text="Custom" variant="info" />
 * </TagGroup>
 */
const TagGroup: React.FC<TagGroupProps> = ({
    children,
    className,
    testId,
}) => {
    return (
        <div
            className={classNames('TagGroup', className)}
            data-testid={testId}
        >
            {children}
        </div>
    );
};

TagGroup.displayName = 'TagGroup';

const MemoTagGroup = memo(TagGroup);
MemoTagGroup.displayName = 'TagGroup';

export default MemoTagGroup;

