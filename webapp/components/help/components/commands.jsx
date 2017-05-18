// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {localizeMessage} from 'utils/utils.jsx';
import {formatText} from 'utils/text_formatting.jsx';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default function HelpCommands() {
    const message = [];
    message.push(localizeMessage('help.commands.title', '# Executing Commands\n___'));
    message.push(localizeMessage('help.commands.intro', 'Slash commands perform operations in Mattermost by typing into the text input box. Enter a `/` followed by a command and some arguments to perform actions.\n\nBuilt-in slash commands come with all Mattermost installations and custom slash commands are configurable to interact with external applications. Learn about configuring custom slash commands on the [developer slash command documentation page](http://docs.mattermost.com/developer/slash-commands.html).'));
    message.push(localizeMessage('help.commands.builtin', '## Built-in Commands\nThe following slash commands are available on all Mattermost installations:'));
    message.push('![commands](https://docs.mattermost.com/_images/slashCommandsTable1.PNG)');
    message.push(localizeMessage('help.commands.builtin2', 'Begin by typing `/` and a list of slash command options appears above the text input box. The autocomplete suggestions help by providing a format example in black text and a short description of the slash command in grey text.'));
    message.push('![autocomplete](https://docs.mattermost.com/_images/slashCommandsAutocomplete.PNG)');
    message.push(localizeMessage('help.commands.custom', '## Custom Commands\nCustom slash commands integrate with external applications. For example, a team might configure a custom slash command to check internal health records with `/patient joe smith` or check the weekly weather forecast in a city with `/weather toronto week`. Check with your System Admin or open the autocomplete list by typing `/` to determine if your team configured any custom slash commands.'));
    message.push(localizeMessage('help.commands.custom2', 'Custom slash commands are disabled by default and can be enabled by the System Admin in the **System Console** > **Integrations** > **Webhooks and Commands**. Learn about configuring custom slash commands on the [developer slash command documentation page](http://docs.mattermost.com/developer/slash-commands.html).'));

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
            </ul>
        </div>
    );
}
