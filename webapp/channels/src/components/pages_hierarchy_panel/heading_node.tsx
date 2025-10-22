// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useHistory} from 'react-router-dom';

import {scrollToHeading} from 'utils/page_outline';
import type {Heading} from 'utils/page_outline';

import './heading_node.scss';

interface HeadingNodeProps {
    heading: Heading;
    pageId: string;
    currentPageId?: string;
    teamName: string;
}

const HeadingNode: React.FC<HeadingNodeProps> = ({heading, pageId, currentPageId, teamName}) => {
    const history = useHistory();

    const paddingLeft = ((heading.level - 1) * 16) + 16;

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (currentPageId === pageId) {
            scrollToHeading(heading.id);
        } else {
            history.push(`/${teamName}/pl/${pageId}`);
            setTimeout(() => {
                scrollToHeading(heading.id);
            }, 500);
        }
    }, [currentPageId, pageId, teamName, heading.id, history]);

    return (
        <div
            className='HeadingNode'
            style={{
                paddingLeft: `${paddingLeft}px`,
            }}
        >
            <button
                className='HeadingNode__button'
                onClick={handleClick}
                role='treeitem'
                aria-level={heading.level}
                aria-label={`Heading level ${heading.level}: ${heading.text}`}
            >
                <i className='icon icon-text-short'/>
                <span className='HeadingNode__text'>{heading.text}</span>
            </button>
        </div>
    );
};

export default HeadingNode;
