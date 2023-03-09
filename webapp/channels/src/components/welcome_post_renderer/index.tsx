// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useIntl} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import {Post} from '@mattermost/types/posts';
import {submitCommand} from 'actions/views/create_comment';
import PostMarkdown from 'components/post_markdown';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {PostDraft} from 'types/store/draft';
import {localizeMessage} from 'utils/utils';

import './index.scss';

export default function WelcomePostRenderer(props: {post: Post}) {
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const currentChannelId = useSelector(getCurrentChannelId);
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

    let message = '';
    const actions: React.ReactNode[] = [];

    const makeOnClickForCommand = (command: string) => {
        return () => {
            const draft: PostDraft = {
                message: command,
                uploadsInProgress: [],
                fileInfos: [],
            } as unknown as PostDraft;
            dispatch(submitCommand(currentChannelId, '', draft));
        };
    };

    const makeButton = (text: React.ReactNode, command: string) => {
        return (
            <button
                onClick={makeOnClickForCommand(command)}
            >
                {text}
            </button>
        );
    };

    const helpButton = makeButton(formatMessage({
        id: 'welcome_post_renderer.button_label.slash_help',
        defaultMessage: '/help',
    }), '/help');

    if (isAdmin) {
        message = [
            '### ' + localizeMessage('welcome_post_renderer.admin_message.title', 'Welcome to Mattermost! :rocket:'),
            '',
            localizeMessage('welcome_post_renderer.admin_message.first_paragraph', 'Mattermost is an open source platform for secure communication, collaboration, and orchestration of work across tools and teams.'),
            localizeMessage('welcome_post_renderer.admin_message.second_paragraph', 'Here is a list of commands to use to try and get familiar with the platform.'),
        ].join('\n');

        actions.push(makeButton(formatMessage({
            id: 'welcome_post_renderer.button_label.slash_marketplace',
            defaultMessage: '/marketplace',
        }), '/marketplace'));
    } else {
        message = [
            '### ' + localizeMessage('welcome_post_renderer.user_message.title', 'Welcome to Mattermost! :rocket:'),
            '',
            localizeMessage('welcome_post_renderer.user_message.first_paragraph', 'Mattermost is an open source platform for secure communication, collaboration, and orchestration of work across tools and teams.'),
            localizeMessage('welcome_post_renderer.user_message.second_paragraph', 'Here is a list of commands to use to try and get familiar with the platform.'),
        ].join('\n');

        actions.push(makeButton(formatMessage({
            id: 'welcome_post_renderer.button_label.slash_settings',
            defaultMessage: '/settings',
        }), '/settings'));
    }
    actions.push(helpButton);

    return (
        <div className='WelcomePostRenderer'>
            <PostMarkdown
                message={message}
                isRHS={false}
                post={props.post}
                channelId={props.post.channel_id}
                mentionKeys={[]}
            />
            {actions.length > 0 && (
                <div className='WelcomePostRenderer__ActionsContainer'>
                    {actions.map((action, idx) => (
                        <div
                            key={'action-' + idx}
                        >
                            {action}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
