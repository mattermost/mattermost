// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

export type HelpPage = 'messaging' | 'sending' | 'mentioning' | 'formatting' | 'attaching' | 'commands';

interface Props {
    excludePage?: HelpPage;
}

const HelpLinks = ({excludePage}: Props): JSX.Element => {
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
                        <Link to='/help'>
                            <FormattedMessage
                                id='help.link.messaging'
                                defaultMessage='Messaging Basics'
                            />
                        </Link>
                    </li>
                )}
                {excludePage !== 'sending' && (
                    <li>
                        <Link to='/help/sending'>
                            <FormattedMessage
                                id='help.link.sending'
                                defaultMessage='Sending Messages'
                            />
                        </Link>
                    </li>
                )}
                {excludePage !== 'mentioning' && (
                    <li>
                        <Link to='/help/mentioning'>
                            <FormattedMessage
                                id='help.link.mentioning'
                                defaultMessage='Mentioning Teammates'
                            />
                        </Link>
                    </li>
                )}
                {excludePage !== 'formatting' && (
                    <li>
                        <Link to='/help/formatting'>
                            <FormattedMessage
                                id='help.link.formatting'
                                defaultMessage='Formatting Messages Using Markdown'
                            />
                        </Link>
                    </li>
                )}
                {excludePage !== 'attaching' && (
                    <li>
                        <Link to='/help/attaching'>
                            <FormattedMessage
                                id='help.link.attaching'
                                defaultMessage='Attaching Files'
                            />
                        </Link>
                    </li>
                )}
                {excludePage !== 'commands' && (
                    <li>
                        <Link to='/help/commands'>
                            <FormattedMessage
                                id='help.link.commands'
                                defaultMessage='Executing Commands'
                            />
                        </Link>
                    </li>
                )}
            </ul>
        </div>
    );
};

export default HelpLinks;
