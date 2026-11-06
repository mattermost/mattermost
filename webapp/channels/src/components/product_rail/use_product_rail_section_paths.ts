// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getFirstBoardInCurrentTeam, getProductRailLastPath} from 'selectors/views/product_rail';

import type {GlobalState} from 'types/store';

/**
 * Where Channels and Boards take the user in the current team, from the rail or the product menu:
 * back to where they last were under each, else the team's default channel and its first board.
 * `boardsPath` is undefined when there's no board to open; Boards still switches the sidebar then,
 * so it can say there are none.
 */
export default function useProductRailSectionPaths(): {channelsPath?: string; boardsPath?: string} {
    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamId = currentTeam?.id ?? '';
    const lastChannelPath = useSelector((state: GlobalState) => getProductRailLastPath(state, 'channels', currentTeamId));
    const lastBoardPath = useSelector((state: GlobalState) => getProductRailLastPath(state, 'boards', currentTeamId));
    const defaultChannelName = useSelector((state: GlobalState) => (currentTeamId ? getRedirectChannelNameForTeam(state, currentTeamId) : ''));
    const firstBoard = useSelector(getFirstBoardInCurrentTeam);

    if (!currentTeam) {
        return {};
    }
    return {
        channelsPath: lastChannelPath ?? `/${currentTeam.name}/channels/${defaultChannelName}`,
        boardsPath: lastBoardPath ?? (firstBoard ? `/${currentTeam.name}/channels/${firstBoard.name}` : undefined),
    };
}
