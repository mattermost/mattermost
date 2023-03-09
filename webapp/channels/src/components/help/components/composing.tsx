// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import HelpLinks from 'components/help/components/help_links';
import {HelpLink} from 'components/help/types';

export default function HelpComposing(): JSX.Element {
    return (
        <div>
            <h1 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.title'
                    defaultMessage='Sending Messages'
                />
            </h1>
            <hr/>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.types.title'
                    defaultMessage='Message Types'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.composing.types.description'
                    defaultMessage='Reply to posts to keep conversations organized in threads.'
                />
            </p>
            <h4 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.posts.title'
                    defaultMessage='Posts'
                />
            </h4>
            <p>
                <FormattedMessage
                    id='help.composing.posts.description'
                    defaultMessage='Posts are considered parent messages when they start a thread of replies. Posts are composed and sent from the text input box at the bottom of the center pane.'
                />
            </p>
            <h4 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.replies.title'
                    defaultMessage='Replies'
                />
            </h4>
            <p>
                <FormattedMarkdownMessage
                    id='help.composing.replies.description1'
                    defaultMessage='Select the **Reply** icon next to any message to open the right-hand sidebar to respond to a thread.'
                />
            </p>
            <p>
                <FormattedMarkdownMessage
                    id='help.composing.replies.description2'
                    defaultMessage='When composing a reply, select the **Expand Sidebar/Collapse Sidebar** icon in the top right corner of the right-hand sidebar to make conversations easier to read.'
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.posting.title'
                    defaultMessage='Post a Message'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.composing.posting.description'
                    defaultMessage='Write a message by typing into the text input box, then press **ENTER** to send it. Press **SHIFT+ENTER** to create a new line without sending a message. To send messages by pressing **CTRL+ENTER**, go to **Settings > Advanced > Send Messages on CTRL/CMD+ENTER**.'
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.editing.title'
                    defaultMessage='Edit a Message'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.composing.editing.description'
                    defaultMessage={'Edit a message by selecting the **More Actions [...]** icon next to any message text that you\'ve composed, then select **Edit**. After making modifications to the message text, press **ENTER** to save the modifications. Message edits don\'t trigger new @mention notifications, desktop notifications, or notification sounds.'}
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.deleting.title'
                    defaultMessage='Delete a Message'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.composing.deleting.description'
                    defaultMessage={'Delete a message by selecting the **More Actions [...]** icon next to any message text that you\'ve composed, then select **Delete**. System and Team Admins can delete any message on their system or team.'}
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.composing.linking.title'
                    defaultMessage='Link to a Message'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.composing.linking.description'
                    defaultMessage='Get a permanent link to a message by selecting the **More Actions [...]** icon next to any message, then select **Copy Link**. Users must be a member of the channel to view the message link.'
                />
            </p>
            <HelpLinks excludedLinks={[HelpLink.Composing]}/>
        </div>
    );
}
