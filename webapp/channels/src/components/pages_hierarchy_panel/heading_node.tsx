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
    wikiId?: string;
    channelId?: string;
}

const HeadingNode: React.FC<HeadingNodeProps> = ({heading, pageId, currentPageId, teamName, wikiId, channelId}) => {
    const history = useHistory();

    const paddingLeft = ((heading.level - 1) * 12) + 18;

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (currentPageId === pageId) {
            scrollToHeading(heading.id);
        } else {
            const wikiUrl = wikiId && channelId ? `/${teamName}/wiki/${channelId}/${wikiId}/${pageId}` : `/${teamName}/pl/${pageId}`;
            history.push(wikiUrl);
            setTimeout(() => {
                scrollToHeading(heading.id);
            }, 500);
        }
    }, [currentPageId, pageId, teamName, wikiId, channelId, heading.id, history]);

    return (
        <div
            className='HeadingNode'
        >
            <button
                className='HeadingNode__button'
                style={{
                    paddingLeft: `${paddingLeft}px`,
                }}
                onClick={handleClick}
                role='treeitem'
                aria-level={heading.level}
                aria-label={`Heading level ${heading.level}: ${heading.text}`}
            >
                <span className='HeadingNode__text'>{heading.text}</span>
            </button>
        </div>
    );
};

export default HeadingNode;
