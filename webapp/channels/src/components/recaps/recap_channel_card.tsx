// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {RecapChannel} from '@mattermost/types/recaps';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import ExternalLink from 'components/external_link';

import type {GlobalState} from 'types/store';

import RecapTextFormatter from './recap_text_formatter';

type Props = {
    channel: RecapChannel;
};

type ParsedItem = {
    text: string;
    permalink: string | null;
};

// Helper function to parse permalink from text
const parsePermalink = (text: string): ParsedItem => {
    // Match pattern: [PERMALINK:url]
    const permalinkRegex = /\[PERMALINK:([^\]]+)\]/;
    const match = text.match(permalinkRegex);

    if (match) {
        return {
            text: text.replace(permalinkRegex, '').trim(),
            permalink: match[1],
        };
    }

    return {
        text,
        permalink: null,
    };
};

const RecapChannelCard = ({channel}: Props) => {
    const {formatMessage} = useIntl();
    const history = useHistory();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const channelObject = useSelector((state: GlobalState) => getChannel(state, channel.channel_id));
    const currentTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const hasHighlights = channel.highlights && channel.highlights.length > 0;
    const hasActionItems = channel.action_items && channel.action_items.length > 0;

    const handleChannelClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (channelObject) {
            history.push(`${currentTeamUrl}/channels/${channelObject.name}`);
        }
    }, [channelObject, currentTeamUrl, history]);

    if (!hasHighlights && !hasActionItems) {
        return null;
    }

    return (
        <div className='recap-channel-card'>
            <div className='recap-channel-header'>
                <button
                    className='recap-channel-name-tag'
                    onClick={handleChannelClick}
                    disabled={!channelObject}
                >
                    {channel.channel_name}
                </button>
                <button
                    className='recap-channel-collapse-button'
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <i className={`icon ${isCollapsed ? 'icon-chevron-down' : 'icon-chevron-up'}`}/>
                </button>
            </div>

            {!isCollapsed && (
                <div className='recap-channel-content'>
                    {hasHighlights && (
                        <div className='recap-section'>
                            <h4 className='recap-section-title'>
                                {formatMessage({id: 'recaps.highlights', defaultMessage: 'Highlights'})}
                            </h4>
                            <ul className='recap-list'>
                                {channel.highlights.map((highlight, index) => {
                                    const {text, permalink} = parsePermalink(highlight);
                                    return (
                                        <li
                                            key={index}
                                            className='recap-list-item'
                                        >
                                            <RecapTextFormatter
                                                text={text}
                                                className='recap-item-text'
                                            />
                                            {permalink ? (
                                                <ExternalLink
                                                    href={permalink}
                                                    className='recap-item-badge recap-item-badge-link'
                                                    location='recap_highlight_badge'
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {index + 1}
                                                </ExternalLink>
                                            ) : (
                                                <span className='recap-item-badge'>{index + 1}</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {hasActionItems && (
                        <div className='recap-section'>
                            <h4 className='recap-section-title'>
                                {formatMessage({id: 'recaps.actionItems', defaultMessage: 'Action items:'})}
                            </h4>
                            <ul className='recap-list'>
                                {channel.action_items.map((actionItem, index) => {
                                    const {text, permalink} = parsePermalink(actionItem);
                                    const badgeNumber = (hasHighlights ? channel.highlights.length : 0) + index + 1;
                                    return (
                                        <li
                                            key={index}
                                            className='recap-list-item'
                                        >
                                            <RecapTextFormatter
                                                text={text}
                                                className='recap-item-text'
                                            />
                                            {permalink ? (
                                                <ExternalLink
                                                    href={permalink}
                                                    className='recap-item-badge recap-item-badge-link'
                                                    location='recap_action_item_badge'
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {badgeNumber}
                                                </ExternalLink>
                                            ) : (
                                                <span className='recap-item-badge'>
                                                    {badgeNumber}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RecapChannelCard;

