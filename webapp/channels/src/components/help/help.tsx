// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useParams} from 'react-router-dom';

import HelpAttaching from './attaching';
import HelpCommands from './commands';
import HelpFormatting from './formatting';
import HelpMentioning from './mentioning';
import HelpMessaging from './messaging';
import HelpSending from './sending';

type HelpPage = 'messaging' | 'sending' | 'mentioning' | 'formatting' | 'attaching' | 'commands';

const Help = (): JSX.Element => {
    const {page} = useParams<{page?: string}>();

    // Default to messaging (the landing page)
    const currentPage = (page || 'messaging') as HelpPage;

    // Scroll to top when page changes
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentPage]);

    switch (currentPage) {
    case 'sending':
        return <HelpSending/>;
    case 'mentioning':
        return <HelpMentioning/>;
    case 'formatting':
        return <HelpFormatting/>;
    case 'attaching':
        return <HelpAttaching/>;
    case 'commands':
        return <HelpCommands/>;
    case 'messaging':
    default:
        return <HelpMessaging/>;
    }
};

export default Help;

