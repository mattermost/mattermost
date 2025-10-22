// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import type {RecapChannel} from '@mattermost/types/recaps';

type Props = {
    channel: RecapChannel;
};

const RecapChannelCard = ({channel}: Props) => {
    const {formatMessage} = useIntl();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const hasHighlights = channel.highlights && channel.highlights.length > 0;
    const hasActionItems = channel.action_items && channel.action_items.length > 0;

    if (!hasHighlights && !hasActionItems) {
        return null;
    }

    return (
        <div className='recap-channel-card'>
            <div className='recap-channel-header'>
                <div className='recap-channel-name-tag'>
                    {channel.channel_name}
                </div>
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
                                {channel.highlights.map((highlight, index) => (
                                    <li
                                        key={index}
                                        className='recap-list-item'
                                    >
                                        <span
                                            className='recap-item-text'
                                            dangerouslySetInnerHTML={{__html: highlight}}
                                        />
                                        <span className='recap-item-badge'>{index + 1}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {hasActionItems && (
                        <div className='recap-section'>
                            <h4 className='recap-section-title'>
                                {formatMessage({id: 'recaps.actionItems', defaultMessage: 'Action items:'})}
                            </h4>
                            <ul className='recap-list'>
                                {channel.action_items.map((actionItem, index) => (
                                    <li
                                        key={index}
                                        className='recap-list-item'
                                    >
                                        <span
                                            className='recap-item-text'
                                            dangerouslySetInnerHTML={{__html: actionItem}}
                                        />
                                        <span className='recap-item-badge'>
                                            {(hasHighlights ? channel.highlights.length : 0) + index + 1}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RecapChannelCard;

