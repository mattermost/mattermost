// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {localizeMessage} from 'utils/utils.jsx';
import {formatText} from 'utils/text_formatting.jsx';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default function HelpMessaging() {
    const message = [];
    message.push(localizeMessage('help.messaging.title', '# Messaging Basics\n_____'));
    message.push(localizeMessage('help.messaging.write', '**Write messages** using the text input box at the bottom of Mattermost. Press ENTER to send a message. Use SHIFT+ENTER to create a new line without sending a message.'));
    message.push(localizeMessage('help.messaging.reply', '**Reply to messages** by clicking the reply arrow next to the message text.'));
    message.push('![reply arrow](https://docs.mattermost.com/_images/replyIcon.PNG)');
    message.push(localizeMessage('help.messaging.notify', '**Notify teammates** when they are needed by typing `@username`.'));
    message.push(localizeMessage('help.messaging.format', '**Format your messages** using Markdown that supports text styling, headings, links, emoticons, code blocks, block quotes, tables, lists and in-line images.'));
    message.push('![markdown](https://docs.mattermost.com/_images/messagesTable1.PNG)');
    message.push(localizeMessage('help.messaging.emoji', '**Quickly add emoji** by typing ":", which will open an emoji autocomplete. If the existing emoji don\'t cover what you want to express, you can also create your own [Custom Emoji](http://docs.mattermost.com/help/settings/custom-emoji.html).'));
    message.push(localizeMessage('help.messaging.attach', '**Attach files** by dragging and dropping into Mattermost or clicking the attachment icon in the text input box.'));

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
                    <Link to='/help/composing'>
                        <FormattedMessage
                            id='help.link.composing'
                            defaultMessage='Composing Messages and Replies'
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
