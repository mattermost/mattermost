// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';

import HelpLinks from './help_links';
import useHelpPageTitle from './use_help_page_title';

import './help.scss';

const title = defineMessage({id: 'help.messaging.title', defaultMessage: 'Messaging Basics'});

const HelpMessaging = (): JSX.Element => {
    useHelpPageTitle(title);

    return (
        <div className='Help'>
            <div className='Help__header'>
                <h1>
                    <FormattedMessage
                        id='help.messaging.title'
                        defaultMessage='Messaging Basics'
                    />
                </h1>
            </div>

            <div className='Help__content'>
                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.messaging.write.title'
                            defaultMessage='Write Messages'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.messaging.write.description'
                            defaultMessage='Use the text input box at the bottom of the Mattermost interface to write a message. Press <b>ENTER</b> to send the message. Use <b>SHIFT+ENTER</b> to create a new line without sending a message.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.messaging.reply.title'
                            defaultMessage='Reply to Messages'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.messaging.reply.description'
                            defaultMessage='Select the Reply Arrow icon next to the text input box.'
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.messaging.notify.title'
                            defaultMessage='Notify Teammates'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.messaging.notify.description'
                            defaultMessage='Type <code>@username</code> to get the attention of specific team members.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.messaging.formatting.title'
                            defaultMessage='Format Your Messages'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.messaging.formatting.description'
                            defaultMessage='Use Markdown to include text styling, headings, links, emoticons, code blocks, block quotes, tables, lists, and in-line images in your messages. See the following table for common formatting examples.'
                        />
                    </p>
                    <table className='Help__table'>
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        id='help.messaging.table.text_entered'
                                        defaultMessage='Text Entered'
                                    />
                                </th>
                                <th>
                                    <FormattedMessage
                                        id='help.messaging.table.how_it_appears'
                                        defaultMessage='How it appears'
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>{'_italic_'}</code></td>
                                <td><em>{'italic'}</em></td>
                            </tr>
                            <tr>
                                <td><code>{'**bold**'}</code></td>
                                <td><strong>{'bold'}</strong></td>
                            </tr>
                            <tr>
                                <td><code>{'~~strikethrough~~'}</code></td>
                                <td><del>{'strikethrough'}</del></td>
                            </tr>
                            <tr>
                                <td><code>{'`In-line code`'}</code></td>
                                <td><code className='Help__inline-code'>{'In-line code'}</code></td>
                            </tr>
                            <tr>
                                <td><code>{'[hyperlink](https://www.mattermost.com)'}</code></td>
                                <td><a href='https://www.mattermost.com'>{'hyperlink'}</a></td>
                            </tr>
                            <tr>
                                <td><code>{'![embedded image](travis-ci.org/mattermost/platform.svg)'}</code></td>
                                <td>
                                    <span className='Help__badge'>{'build'}</span>
                                    <span className='Help__badge Help__badge--secondary'>{'unknown'}</span>
                                </td>
                            </tr>
                            <tr>
                                <td><code>{':smile: :sheep: :alien:'}</code></td>
                                <td>{'😄 🐑 👽'}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.messaging.emoji.title'
                            defaultMessage='Add an Emoji'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.messaging.emoji.description'
                            defaultMessage={'Type <code>:</code> to open an emoji autocomplete. If the existing emojis don\'t say what you want to express, you can also create your own <link>Custom Emoji</link>.'}
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                                link: (chunks: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/end-user-guide/collaborate/react-with-emojis-gifs.html#upload-custom-emojis'
                                        location='help_messaging'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.messaging.attach.title'
                            defaultMessage='Attach Files'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.messaging.attach.description'
                            defaultMessage='Drag and drop files into Mattermost, or select the Attachment icon in the text input box.'
                        />
                    </p>
                </section>

                <HelpLinks excludePage='messaging'/>
            </div>
        </div>
    );
};

export default HelpMessaging;
