// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';

import {handleFormattedTextClick} from 'utils/utils';

type Props = {
    text: string;
    className?: string;
};

const RecapTextFormatter = ({text, className}: Props) => {
    const channelNamesMap = useSelector(getChannelsNameMapInCurrentTeam);
    const currentTeam = useSelector(getCurrentTeam);
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    // Remove any existing HTML tags from the text for safety
    const cleanText = text.replace(/<[^>]*>/g, '');

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        handleFormattedTextClick(e, currentRelativeTeamUrl);
    }, [currentRelativeTeamUrl]);

    return (
        <div
            className={className}
            onClick={handleClick}
        >
            {/* This component is leveraged so that @username's can be clicked, showing the user info popover */}
            <Markdown
                message={cleanText}
                channelNamesMap={channelNamesMap}
                options={{
                    atMentions: true,
                    markdown: false, // Disable markdown parsing since this is plain text
                    singleline: false,
                    mentionHighlight: false, // Don't highlight mentions in recaps
                    team: currentTeam,
                }}
            />
        </div>
    );
};

export default RecapTextFormatter;

