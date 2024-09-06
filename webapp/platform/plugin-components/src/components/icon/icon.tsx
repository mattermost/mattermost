// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export type Props = {
    icon: string;
}

// Refer icon names from here - https://mattermost.github.io/compass-icons/
export default function Icon({icon}: Props) {
    return (
        <span
            aria-hidden='true'
            className={`user_survey_icon icon icon-${icon}`}
        />
    );
}
