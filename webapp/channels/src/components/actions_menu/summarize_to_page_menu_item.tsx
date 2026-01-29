// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {getAgents} from 'mattermost-redux/selectors/entities/agents';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import * as Menu from 'components/menu';

import {getWikiUrl} from 'utils/url';

import type {GlobalState} from 'types/store';

type Props = {
    post: Post;
    onMenuClose?: () => void;
};

const SummarizeToPageMenuItem: React.FC<Props> = ({post, onMenuClose}) => {
    const history = useHistory();
    const team = useSelector(getCurrentTeam);
    const agents = useSelector(getAgents);

    // Get wiki for the post's channel
    const wikiId = useSelector((state: GlobalState) => {
        const channelWikiIds = state.entities.wikis?.byChannel?.[post.channel_id];
        if (channelWikiIds && channelWikiIds.length > 0) {
            // Return the first wiki ID for the channel
            return channelWikiIds[0];
        }
        return null;
    });

    const handleClick = useCallback(async () => {
        if (!wikiId || !team) {
            return;
        }

        // Get the first available agent
        const agent = agents?.[0];
        if (!agent) {
            // eslint-disable-next-line no-alert
            alert('No AI agents available. Please configure an AI agent in the system console.');
            return;
        }

        // Prompt for page title
        // eslint-disable-next-line no-alert
        const title = prompt('Enter a title for the new page:');
        if (!title || title.trim() === '') {
            return;
        }

        // Close the menu
        onMenuClose?.();

        try {
            // Call the API to summarize thread to page
            const threadId = post.root_id || post.id;
            const pageId = await Client4.summarizeThreadToPage(wikiId, agent.id, threadId, title.trim());

            // Navigate to the newly created page
            const wikiUrl = getWikiUrl(team.name, wikiId, pageId);
            history.push(wikiUrl);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to summarize thread to page:', error);
            // eslint-disable-next-line no-alert
            alert('Failed to create page from thread summary. Please try again.');
        }
    }, [wikiId, team, agents, post, onMenuClose, history]);

    // Don't render if no wiki or no agents
    if (!wikiId || !agents || agents.length === 0) {
        return null;
    }

    return (
        <Menu.Item
            id={`summarize_to_page_${post.id}`}
            data-testid={`summarize_to_page_${post.id}`}
            labels={
                <FormattedMessage
                    id='post_info.summarize_to_page'
                    defaultMessage='Summarize to Page'
                />
            }
            leadingElement={<i className='icon icon-file-document-outline'/>}
            onClick={handleClick}
        />
    );
};

export default SummarizeToPageMenuItem;
