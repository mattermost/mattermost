// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {isPopoutWindow} from 'utils/popouts/popout_windows';

export type HelpPage = 'messaging' | 'sending' | 'mentioning' | 'formatting' | 'attaching' | 'commands';

interface Props {
    excludePage?: HelpPage;
}

const HelpLinks = ({excludePage}: Props): JSX.Element => {
    const basePath = isPopoutWindow() ? '/_popout/help' : '/help';

    return (
        <div className='Help__learn-more'>
            <h2>
                <FormattedMessage
                    id='help.learn_more.title'
                    defaultMessage='Learn more about:'
                />
            </h2>
            <ul>
                {excludePage !== 'messaging' && (
                    <li>
                        <a href={basePath}>
                            <FormattedMessage
                                id='help.link.messaging'
                                defaultMessage='Messaging Basics'
                            />
                        </a>
                    </li>
                )}
                {excludePage !== 'sending' && (
                    <li>
                        <a href={`${basePath}/sending`}>
                            <FormattedMessage
                                id='help.link.sending'
                                defaultMessage='Sending Messages'
                            />
                        </a>
                    </li>
                )}
                {excludePage !== 'mentioning' && (
                    <li>
                        <a href={`${basePath}/mentioning`}>
                            <FormattedMessage
                                id='help.link.mentioning'
                                defaultMessage='Mentioning Teammates'
                            />
                        </a>
                    </li>
                )}
                {excludePage !== 'formatting' && (
                    <li>
                        <a href={`${basePath}/formatting`}>
                            <FormattedMessage
                                id='help.link.formatting'
                                defaultMessage='Formatting Messages Using Markdown'
                            />
                        </a>
                    </li>
                )}
                {excludePage !== 'attaching' && (
                    <li>
                        <a href={`${basePath}/attaching`}>
                            <FormattedMessage
                                id='help.link.attaching'
                                defaultMessage='Attaching Files'
                            />
                        </a>
                    </li>
                )}
                {excludePage !== 'commands' && (
                    <li>
                        <a href={`${basePath}/commands`}>
                            <FormattedMessage
                                id='help.link.commands'
                                defaultMessage='Executing Commands'
                            />
                        </a>
                    </li>
                )}
            </ul>
        </div>
    );
};

export default HelpLinks;
