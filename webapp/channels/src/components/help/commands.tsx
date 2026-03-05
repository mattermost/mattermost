// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';

import HelpLinks from './help_links';
import useHelpPageTitle from './use_help_page_title';

import './help.scss';

const title = defineMessage({id: 'help.commands.title', defaultMessage: 'Executing Commands'});

const HelpCommands = (): JSX.Element => {
    useHelpPageTitle(title);

    return (
        <div className='Help'>
            <div className='Help__header'>
                <h1>
                    <FormattedMessage
                        id='help.commands.title'
                        defaultMessage='Executing Commands'
                    />
                </h1>
            </div>

            <div className='Help__content'>
                <p>
                    <FormattedMessage
                        id='help.commands.intro'
                        defaultMessage='You can execute commands, called slash commands, by typing into the text input box to perform operations in Mattermost. To run a slash command, type <code>/</code> followed by a command and some arguments to perform actions.'
                        values={{
                            code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                        }}
                    />
                </p>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.commands.builtin.title'
                            defaultMessage='Built-In Commands'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.commands.builtin.description'
                            defaultMessage='Built-in slash commands come with all Mattermost installations. See the <link>product documentation</link> for a list of available built-in slash commands.'
                            values={{
                                link: (chunks: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/integrations/slash-commands-built-in.html'
                                        location='help_commands'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.commands.builtin.howto'
                            defaultMessage='Begin by typing <code>/</code>. A list of slash command options displays above the text input box. The autocomplete suggestions provide you with a format example in black text and a short description of the slash command in grey text.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <div className='Help__commands-example'>
                        <div className='Help__commands-header'>
                            <FormattedMessage
                                id='help.commands.example.header'
                                defaultMessage='COMMANDS'
                            />
                        </div>
                        <div className='Help__commands-list'>
                            <div className='Help__command-item'>
                                <span className='Help__command-icon'>{'/'}</span>
                                <div className='Help__command-details'>
                                    <span className='Help__command-name'>{'away'}</span>
                                    <span className='Help__command-desc'>
                                        <FormattedMessage
                                            id='help.commands.example.away'
                                            defaultMessage='Set your status away'
                                        />
                                    </span>
                                </div>
                            </div>
                            <div className='Help__command-item'>
                                <span className='Help__command-icon'>{'/'}</span>
                                <div className='Help__command-details'>
                                    <span className='Help__command-name'>{'code'}</span>
                                    <span className='Help__command-desc'>
                                        <FormattedMessage
                                            id='help.commands.example.code'
                                            defaultMessage='Display text as a code block'
                                        />
                                    </span>
                                </div>
                            </div>
                            <div className='Help__command-item'>
                                <span className='Help__command-icon'>{'/'}</span>
                                <div className='Help__command-details'>
                                    <span className='Help__command-name'>{'collapse'}</span>
                                    <span className='Help__command-desc'>
                                        <FormattedMessage
                                            id='help.commands.example.collapse'
                                            defaultMessage='Turn on auto-collapsing of image previews'
                                        />
                                    </span>
                                </div>
                            </div>
                            <div className='Help__command-item'>
                                <span className='Help__command-icon'>{'/'}</span>
                                <div className='Help__command-details'>
                                    <span className='Help__command-name'>{'dnd'}</span>
                                    <span className='Help__command-desc'>
                                        <FormattedMessage
                                            id='help.commands.example.dnd'
                                            defaultMessage='Do not disturb disables desktop and mobile notifications'
                                        />
                                    </span>
                                </div>
                            </div>
                            <div className='Help__command-item'>
                                <span className='Help__command-icon'>{'/'}</span>
                                <div className='Help__command-details'>
                                    <span className='Help__command-name'>{"echo 'message'"}</span>
                                    <span className='Help__command-desc'>
                                        <FormattedMessage
                                            id='help.commands.example.echo'
                                            defaultMessage='Echo back text from your account'
                                        />
                                    </span>
                                </div>
                            </div>
                            <div className='Help__command-item'>
                                <span className='Help__command-icon'>{'/'}</span>
                                <div className='Help__command-details'>
                                    <span className='Help__command-name'>{'expand'}</span>
                                    <span className='Help__command-desc'>{'...'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.commands.custom.title'
                            defaultMessage='Custom Commands'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.commands.custom.description'
                            defaultMessage='Custom slash commands can integrate with external applications. For example, a team might configure a custom slash command to check internal health records with <code>/patient joe smith</code> or check the weekly weather forecast in a city with <code>/weather toronto week</code>. Check with your System Admin, or open the autocomplete list by typing <code>/</code>, to determine whether custom slash commands are available for your organization.'
                            values={{
                                code: (chunks: React.ReactNode) => <code>{chunks}</code>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.commands.custom.note'
                            defaultMessage='Custom slash commands are disabled by default and can be enabled by the System Admin in the System Console by going to <b>Integrations > Integration Management</b>. Learn about configuring custom slash commands in the <link>developer documentation</link>.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                                link: (chunks: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://developers.mattermost.com/integrate/slash-commands/custom/'
                                        location='help_commands'
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </p>
                </section>

                <HelpLinks excludePage='commands'/>
            </div>
        </div>
    );
};

export default HelpCommands;

