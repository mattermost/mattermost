// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import LeonardRileyAvatar from './avatar.svg';
import HelpLinks from './help_links';
import useHelpPageTitle from './use_help_page_title';

import './help.scss';

const title = defineMessage({id: 'help.mentioning.title', defaultMessage: 'Mentioning Teammates'});

const HelpMentioning = (): JSX.Element => {
    useHelpPageTitle(title);

    return (
        <div className='Help'>
            <div className='Help__header'>
                <h1>
                    <FormattedMessage
                        id='help.mentioning.title'
                        defaultMessage='Mentioning Teammates'
                    />
                </h1>
            </div>

            <div className='Help__content'>
                <section className='Help__section'>
                    <h2>
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

                    <h3>
                        <FormattedMessage
                            id='help.mentioning.username.title'
                            defaultMessage='@Username'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.mentioning.username.description'
                            defaultMessage='You can mention a teammate by using the <code>@</code> symbol plus their username to send them a mention notification.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.mentioning.username.description2'
                            defaultMessage='Type <code>@</code> to bring up a list of team members who can be mentioned. To filter the list, type the first few letters of any username, first name, last name, or nickname. The Up and Down arrow keys can then be used to scroll through entries in the list, and pressing ENTER will select which user to mention. Once selected, the username will automatically replace the full name or nickname. The following example sends a special mention notification to alice that alerts her of the channel and message where she has been mentioned. If alice is away from Mattermost and has email notifications turned on, then she will receive an email alert of her mention along with the message text.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <div className='Help__example-box'>
                        <div className='Help__example-message'>
                            <div className='Help__example-avatar'>
                                <LeonardRileyAvatar/>
                            </div>
                            <div className='Help__example-content'>
                                <span className='Help__example-name'>{'Leonard Riley'}</span>
                                <span className='Help__example-time'>{'10:43 AM'}</span>
                                <p>
                                    <a href='#'>{'@alice'}</a>
                                    {' how did your interview go with the new candidate?'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <p>
                        <FormattedMessage
                            id='help.mentioning.username.not_in_channel'
                            defaultMessage='If the user you mentioned does not belong to the channel, a System Message will be posted to let you know. This is a temporary message only seen by the person who triggered it. To add the mentioned user to the channel, go to the dropdown menu beside the channel name and select Add Members.'
                        />
                    </p>

                    <h3>
                        <FormattedMessage
                            id='help.mentioning.channel.title'
                            defaultMessage='@Channel'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.mentioning.channel.description'
                            defaultMessage='You can mention an entire channel by typing <code>@channel</code>. All members of the channel will receive a mention notification that behaves the same way as if the members had been mentioned personally.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <div className='Help__example-box'>
                        <div className='Help__example-message'>
                            <div className='Help__example-avatar'>
                                <LeonardRileyAvatar/>
                            </div>
                            <div className='Help__example-content'>
                                <span className='Help__example-name'>{'Leonard Riley'}</span>
                                <span className='Help__example-time'>{'10:43 AM'}</span>
                                <p>
                                    <a href='#'>{'@channel'}</a>
                                    {' great work on interviews this week. I think we found some excellent potential candidates!'}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.mentioning.keywords.title'
                            defaultMessage='Keywords That Trigger Mentions'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.mentioning.keywords.description'
                            defaultMessage='In addition to being notified by <code>@username</code> and <code>@channel</code>, you can customize words that trigger mention notifications in <b>Settings > Notifications > Keywords that trigger mentions</b>. By default, you will receive mention notifications on your first name, and you can add more words by typing them into the input box separated by commas. This is useful if you want to be notified of all posts on certain topics, for example, "interviewing" or "marketing".'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.mentioning.recent.title'
                            defaultMessage='Recent Mentions'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.mentioning.recent.description'
                            defaultMessage='Click <code>@</code> icon in right side of the top bar next to your profile picture to view your most recent @mentions and words that trigger mentions.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                </section>

                <HelpLinks excludePage='mentioning'/>
            </div>
        </div>
    );
};

export default HelpMentioning;

