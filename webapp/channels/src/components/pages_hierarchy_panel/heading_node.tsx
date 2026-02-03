// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import WithTooltip from 'components/with_tooltip';

import {scrollToHeading} from 'utils/page_outline';
import type {Heading} from 'utils/page_outline';
import {getWikiUrl} from 'utils/url';

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
    const {formatMessage} = useIntl();
    const history = useHistory();

    const [isTextTruncated, setIsTextTruncated] = useState(false);
    const textRef = useRef<HTMLSpanElement>(null);

    const paddingLeft = ((heading.level - 1) * 12) + 18;

    useEffect(() => {
        const checkTruncation = () => {
            const el = textRef.current;
            if (!el) {
                return;
            }
            setIsTextTruncated(el.scrollWidth > el.clientWidth);
        };

        checkTruncation();
        window.addEventListener('resize', checkTruncation);
        return () => {
            window.removeEventListener('resize', checkTruncation);
        };
    }, [heading.text]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (currentPageId === pageId) {
            scrollToHeading(heading.id);
        } else {
            // Use getWikiUrl for wiki pages, fallback to permalink format for non-wiki pages
            const url = wikiId && channelId ? getWikiUrl(teamName, channelId, wikiId, pageId) : `/${teamName}/pl/${pageId}`;
            history.push(`${url}#${heading.id}`);
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
                aria-selected={false}
                aria-level={heading.level}
                aria-label={formatMessage(
                    {id: 'heading_node.aria_label', defaultMessage: 'Heading level {level}: {text}'},
                    {level: heading.level, text: heading.text},
                )}
            >
                <WithTooltip
                    title={heading.text}
                    disabled={!isTextTruncated}
                >
                    <span
                        ref={textRef}
                        className='HeadingNode__text'
                    >
                        {heading.text}
                    </span>
                </WithTooltip>
            </button>
        </div>
    );
};

export default HeadingNode;
