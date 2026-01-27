// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import HelpLinks from './help_links';
import useHelpPageTitle from './use_help_page_title';

import './help.scss';

const title = defineMessage({id: 'help.sending.title', defaultMessage: 'Sending Messages'});

const HelpSending = (): JSX.Element => {
    useHelpPageTitle(title);

    return (
        <div className='Help'>
            <div className='Help__header'>
                <h1>
                    <FormattedMessage
                        id='help.sending.title'
                        defaultMessage='Sending Messages'
                    />
                </h1>
            </div>

            <div className='Help__content'>
                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.sending.types.title'
                            defaultMessage='Message Types'
                        />
                    </h2>

                    <h3>
                        <FormattedMessage
                            id='help.sending.types.posts.title'
                            defaultMessage='Posts'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.sending.types.posts.description'
                            defaultMessage='Posts are considered parent messages when they start a thread of replies. Posts are composed and sent from the text input box at the bottom of the center pane.'
                        />
                    </p>

                    <h3>
                        <FormattedMessage
                            id='help.sending.types.replies.title'
                            defaultMessage='Replies'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.sending.types.replies.description'
                            defaultMessage='Select the <b>Reply icon</b> next to any message to open the right-hand sidebar to respond to a thread.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.sending.types.replies.description2'
                            defaultMessage='When composing a reply, select the <b>Expand Sidebar/Collapse Sidebar icon</b> in the top right corner of the right-hand sidebar to make conversations easier to read.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.sending.post.title'
                            defaultMessage='Post a Message'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.sending.post.description'
                            defaultMessage='Write a message by typing into the text input box, then press <b>ENTER</b> to send it. Use <b>SHIFT+ENTER</b> to create a new line without sending a message. To send messages by pressing <b>CTRL+ENTER</b>, go to <b>Settings > Advanced > Send Messages on CTRL/CMD+ENTER</b>.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.sending.edit.title'
                            defaultMessage='Edit a Message'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.sending.edit.description'
                            defaultMessage={"Edit a message by selecting the <b>More Actions [...]</b> icon next to any message text that you've composed, then select <b>Edit</b>. After making modifications to the message text, press <b>ENTER</b> to save the modifications. Message edits don't trigger new @mention notifications, desktop notifications, or notification sounds."}
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.sending.delete.title'
                            defaultMessage='Delete a Message'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.sending.delete.description'
                            defaultMessage={"Delete a message by selecting the <b>More Actions [...] icon</b> next to any message text that you've composed, then select <b>Delete</b>. System and Team Admins can delete any message on their system or team."}
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.sending.link.title'
                            defaultMessage='Link to a message'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.sending.link.description'
                            defaultMessage='Get a permanent link to a message by selecting the <b>More Actions [...]</b> icon next to any message, then select <b>Copy Link</b>. Users must be a member of the channel to view the message link.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </section>

                <HelpLinks excludePage='sending'/>
            </div>
        </div>
    );
};

export default HelpSending;

