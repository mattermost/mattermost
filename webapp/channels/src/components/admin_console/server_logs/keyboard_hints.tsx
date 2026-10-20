// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages} from 'react-intl';

import {ShortcutKey, ShortcutKeys, ShortcutKeyVariant} from '@mattermost/shared/components/shortcut_key';

import './keyboard_hints.scss';

const messages = defineMessages({
    title: {id: 'admin.logs.keyboardHints.title', defaultMessage: 'Keyboard shortcuts', description: 'Heading of the keyboard shortcuts tooltip on the System Console Server Logs page.'},
    navigate: {id: 'admin.logs.keyboardHints.navigate', defaultMessage: 'Move between entries', description: 'Shortcut description in the keyboard shortcuts tooltip on the System Console Server Logs page; shown next to the Up and Down arrow keys.'},
    expand: {id: 'admin.logs.keyboardHints.expand', defaultMessage: 'Expand entry', description: 'Shortcut description in the keyboard shortcuts tooltip on the System Console Server Logs page; shown next to the Enter key.'},
    collapse: {id: 'admin.logs.keyboardHints.collapse', defaultMessage: 'Collapse entry', description: 'Shortcut description in the keyboard shortcuts tooltip on the System Console Server Logs page; shown next to the Esc key.'},
    search: {id: 'admin.logs.keyboardHints.search', defaultMessage: 'Search', description: 'Shortcut description in the keyboard shortcuts tooltip on the System Console Server Logs page; shown next to the / key, which focuses the log search box.'},
});

const HINTS: Array<{keys: Array<string | MessageDescriptor>; description: MessageDescriptor}> = [
    {keys: ['↑', '↓'], description: messages.navigate},
    {keys: [ShortcutKeys.enter], description: messages.expand},
    {keys: [ShortcutKeys.escape], description: messages.collapse},
    {keys: ['/'], description: messages.search},
];

export default function KeyboardHints() {
    return (
        <div className='LogKeyboardHints'>
            <div className='LogKeyboardHints__title'>
                <FormattedMessage {...messages.title}/>
            </div>
            {HINTS.map(({keys, description}) => (
                <div
                    key={description.id}
                    className='LogKeyboardHints__row'
                >
                    <span className='LogKeyboardHints__keys'>
                        {keys.map((key) => (
                            <ShortcutKey
                                key={typeof key === 'string' ? key : key.id}
                                variant={ShortcutKeyVariant.Tooltip}
                            >
                                {typeof key === 'string' ? key : <FormattedMessage {...key}/>}
                            </ShortcutKey>
                        ))}
                    </span>
                    <FormattedMessage {...description}/>
                </div>
            ))}
        </div>
    );
}
