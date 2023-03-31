// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import HelpLinks from 'components/help/components/help_links';
import {HelpLink} from 'components/help/types';
import ExternalLink from 'components/external_link';

export default function Mentioning(): JSX.Element {
    return (
        <div>
            <h1 className='markdown__heading'>
                <FormattedMessage
                    id='help.mentioning.title'
                    defaultMessage='Mentioning Teammates'
                />
            </h1>
            <hr/>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.mentioning.mentions.title'
                    defaultMessage='@Mentions'
                />
            </h2>
            <p>
                <FormattedMessage
                    id='help.mentioning.mentions.description'
                    defaultMessage='Use @mentions to get the attention of specific team members.'
                />
            </p>
            <h4 className='markdown__heading'>
                <FormattedMessage
                    id='help.mentioning.username.title'
                    defaultMessage='@Username Mentions'
                />
            </h4>
            <p>
                <FormattedMarkdownMessage
                    id='help.mentioning.username.description1'
                    defaultMessage='You can mention a teammate by using the `@` symbol plus their username to send them a mention notification.'
                />
            </p>
            <p>
                <FormattedMessage
                    id='help.mentioning.username.description2'
                    defaultMessage='Type `@` to bring up a list of team members who can be mentioned. To filter the list, type the first few letters of any username, first name, last name, or nickname. Use the <strong>Up</strong> and <strong>Down</strong> keyboard arrow keys to scroll through entries in the list, then press <strong>ENTER</strong> to select the user to mention. Once selected, the username is automatically replaced with the full name or nickname. The following example sends a special mention notification to <strong>alice</strong> that alerts her of the channel and message where she has been mentioned. If <strong>alice</strong> is away from Mattermost and has <link>email notifications</link> turned on, then she will receive an email alert for the mention along with the message text.'
                    values={{
                        strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                        link: (msg: React.ReactNode) => (
                            <ExternalLink
                                href='https://docs.mattermost.com/messaging/configuring-notifications.html#email-notifications'
                                location='mentioning_help'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </p>
            <div className='post-code post-code--wrap'>
                <code className='hljs'>
                    <FormattedMessage
                        id='help.mentioning.usernameExample'
                        defaultMessage='@alice how did your interview go with the new candidate?'
                    />
                </code>
            </div>
            <p/>
            <p>
                <FormattedMarkdownMessage
                    id='help.mentioning.usernameCont'
                    defaultMessage='If the user you mentioned is not a member of the channel, a System Message is posted to let you know. The System Message is a temporary message only seen by the person who triggered it. To add the mentioned user to the channel, go to the dropdown menu beside the channel name and select **Add Members**.'
                />
            </p>
            <h4 className='markdown__heading'>
                <FormattedMessage
                    id='help.mentioning.channel.title'
                    defaultMessage='@Channel Mentions'
                />
            </h4>
            <p>
                <FormattedMarkdownMessage
                    id='help.mentioning.channel.description'
                    defaultMessage='You can mention an entire channel by typing `@channel`. All members of the channel receive a mention notification that behaves the same way as if the members had been mentioned individually. The following example sends a special mention notification to everyone in the current channel to congratulate them on a job well done.'
                />
            </p>
            <div className='post-code post-code--wrap'>
                <code className='hljs'>
                    <FormattedMessage
                        id='help.mentioning.channelExample'
                        defaultMessage='@channel great work on interviews this week. I think we found some excellent potential candidates!'
                    />
                </code>
            </div>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.mentioning.triggers.title'
                    defaultMessage='Words That Trigger Mentions'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.mentioning.triggers.description'
                    defaultMessage='In addition to being notified with @username and @channel mentions, you can configure Mattermost to trigger mention notifications based on specific words by going to **Settings > Notifications > Words That Trigger Mentions**. By default, you receive mention notifications on your first name. Add more words by typing them into the input box separated by commas. This is useful if you want to be notified of all posts on certain topics, for example, "interviewing" or "marketing".'
                />
            </p>
            <h2 className='markdown__heading'>
                <FormattedMessage
                    id='help.mentioning.recent.title'
                    defaultMessage='Recent Mentions'
                />
            </h2>
            <p>
                <FormattedMarkdownMessage
                    id='help.mentioning.recent.description'
                    defaultMessage='Select `@` next to the Search box to query for your most recent @mentions and words that trigger mentions. Select **Jump** next to a search result in the right-hand sidebar to jump the center pane to the channel and location of the message with the mention.'
                />
            </p>
            <HelpLinks excludedLinks={[HelpLink.Mentioning]}/>
        </div>
    );
}
