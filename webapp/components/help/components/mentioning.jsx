// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {localizeMessage} from 'utils/utils.jsx';
import {formatText} from 'utils/text_formatting.jsx';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default function HelpMentioning() {
    const message = [];
    message.push(localizeMessage('help.mentioning.title', '# Mentioning Teammates\n_____'));
    message.push(localizeMessage('help.mentioning.mentions', '## @Mentions\nUse @mentions to get the attention of specific team members.'));
    message.push(localizeMessage('help.mentioning.username', '#### @Username\nYou can mention a teammate by using the `@` symbol plus their username to send them a mention notification.\n\nType `@` to bring up a list of team members who can be mentioned. To filter the list, type the first few letters of any username, first name, last name, or nickname. The **Up** and **Down** arrow keys can then be used to scroll through entries in the list, and pressing **ENTER** will select which user to mention. Once selected, the username will automatically replace the full name or nickname.\nThe following example sends a special mention notification to **alice** that alerts her of the channel and message where she has been mentioned. If **alice** is away from Mattermost and has [email notifications](http://docs.mattermost.com/help/getting-started/configuring-notifications.html#email-notifications) turned on, then she will receive an email alert of her mention along with the message text.'));
    message.push('```\n' + localizeMessage('help.mentioning.usernameExample', '@alice how did your interview go with the new candidate?') + '\n```');
    message.push('\n\n ');
    message.push(localizeMessage('help.mentioning.usernameCont', 'If the user you mentioned does not belong to the channel, a System Message will be posted to let you know. This is a temporary message only seen by the person who triggered it. To add the mentioned user to the channel, go to the dropdown menu beside the channel name and select **Add Members**.'));
    message.push(localizeMessage('help.mentioning.channel', '#### @Channel\nYou can mention an entire channel by typing `@channel`. All members of the channel will receive a mention notification that behaves the same way as if the members had been mentioned personally.'));
    message.push('```\n' + localizeMessage('help.mentioning.channelExample', '@channel great work on interviews this week. I think we found some excellent potential candidates!') + '```\n');
    message.push(localizeMessage('help.mentioning.triggers', '## Words That Trigger Mentions\nIn addition to being notified by @username and @channel, you can customize words that trigger mention notifications in **Account Settings** > **Notifications** > **Words that trigger mentions**. By default, you will receive mention notifications on your first name, and you can add more words by typing them into the input box separated by commas. This is useful if you want to be notified of all posts on certain topics, for example, "interviewing" or "marketing".'));
    message.push(localizeMessage('help.mentioning.recent', '## Recent Mentions\nClick `@` next to the search box to query for your most recent @mentions and words that trigger mentions. Click **Jump** next to a search result in the RHS to jump the center pane to the channel and location of the message with the mention.'));

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
                    <Link to='/help/composing'>
                        <FormattedMessage
                            id='help.link.composing'
                            defaultMessage='Composing Messages and Replies'
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
