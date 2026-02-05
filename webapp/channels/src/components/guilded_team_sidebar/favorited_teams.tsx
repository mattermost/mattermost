// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

interface Props {
    onTeamClick: () => void;
    onExpandClick: () => void;
}

export default function FavoritedTeams({onTeamClick, onExpandClick}: Props) {
    return (
        <div className='favorited-teams'>
            {/* Will show favorited teams */}
        </div>
    );
}
