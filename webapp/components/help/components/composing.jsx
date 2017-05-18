// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {localizeMessage} from 'utils/utils.jsx';
import {formatText} from 'utils/text_formatting.jsx';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default function HelpComposing() {
    const message = [];
    message.push(localizeMessage('help.composing.title', '# Sending Messages\n_____'));
    message.push(localizeMessage('help.composing.types', '## Message Types\nReply to posts to keep conversations organized in threads.'));
    message.push(localizeMessage('help.composing.posts', '#### Posts\nPosts can be considered parent messages. They are the messages that often start a thread of replies. Posts are composed and sent from the text input box at the bottom of the center pane.'));
    message.push(localizeMessage('help.composing.replies', '#### Replies\nReply to a message by clicking the reply icon next to any message text. This action opens the right-hand-side (RHS) where you can see the message thread, then compose and send your reply. Replies are indented slightly in the center pane to indicate that they are child messages of a parent post.\n\nWhen composing a reply in the right-hand side, click the expand/collapse icon with two arrows at the top of the sidebar to make things easier to read.'));
    message.push(localizeMessage('help.composing.posting', '## Posting a Message\nWrite a message by typing into the text input box, then press ENTER to send it. Use SHIFT+ENTER to create a new line without sending a message. To send messages by pressing CTRL+ENTER go to **Main Menu > Account Settings > Send messages on CTRL+ENTER**.'));
    message.push(localizeMessage('help.composing.editing', '## Editing a Message\nEdit a message by clicking the **[...]** icon next to any message text that you’ve composed, then click **Edit**. After making modifications to the message text, press **ENTER** to save the modifications. Message edits do not trigger new @mention notifications, desktop notifications or notification sounds.'));
    message.push(localizeMessage('help.composing.deleting', '## Deleting a message\nDelete a message by clicking the **[...]** icon next to any message text that you’ve composed, then click **Delete**. System and Team Admins can delete any message on their system or team.'));
    message.push(localizeMessage('help.composing.linking', '## Linking to a message\nThe **Permalink** feature creates a link to any message. Sharing this link with other users in the channel lets them view the linked message in the Message Archives. Users who are not a member of the channel where the message was posted cannot view the permalink. Get the permalink to any message by clicking the **[...]** icon next to the message text > **Permalink** > **Copy Link**.'));

    return (
        <div>
            <span
                dangerouslySetInnerHTML={{__html: formatText(message.join('\n\n'))}}
            />
            <p className='links'>
                <FormattedMessage
                    id='help.learnMore'
                    defaultMessage='Learn more about:'
                />
            </p>
            <ul>
                <li>
                    <Link to='/help/messaging'>
                        <FormattedMessage
                            id='help.link.messaging'
                            defaultMessage='Basic Messaging'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/mentioning'>
                        <FormattedMessage
                            id='help.link.mentioning'
                            defaultMessage='Mentioning Teammates'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/formatting'>
                        <FormattedMessage
                            id='help.link.formatting'
                            defaultMessage='Formatting Messages using Markdown'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/attaching'>
                        <FormattedMessage
                            id='help.link.attaching'
                            defaultMessage='Attaching Files'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/commands'>
                        <FormattedMessage
                            id='help.link.commands'
                            defaultMessage='Executing Commands'
                        />
                    </Link>
                </li>
            </ul>
        </div>
    );
}
