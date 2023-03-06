// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {Team} from '@mattermost/types/teams';

import {getChannelsNameMapInTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getTeam} from 'mattermost-redux/selectors/entities/teams';

import {formatText, messageHtmlToComponent} from 'src/webapp_globals';

export const useDefaultMarkdownOptions = ({team, ...opts}: {team?: Maybe<Team | Team['id']>} & Record<string, any> = {}) => {
    const selectedTeam = useSelector((state: GlobalState) => {
        if (typeof team === 'string') {
            return getTeam(state, team);
        }
        return team ?? getCurrentTeam(state);
    });
    const channelNamesMap = useSelector((state: GlobalState) => selectedTeam && getChannelsNameMapInTeam(state, selectedTeam.id));

    return {
        singleline: false,
        atMentions: true,
        mentionHighlight: false,
        team: selectedTeam,
        channelNamesMap,
        ...opts,
    };
};

type Props = {
    value: string;
    teamId?: string;
    options?: Record<string, any>;
};

const FormattedMarkdown = ({
    value,
    options,
}: Props) => {
    const opts = useDefaultMarkdownOptions(options);
    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };

    return messageHtmlToComponent(formatText(value, opts), true, messageHtmlToComponentOptions);
};

export default FormattedMarkdown;
