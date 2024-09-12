// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Tag from 'components/widgets/tag/tag';

const errorCodeToErrorMessage = {
    
}

type Props = {
    errorCode: string;
}

export default function ScheduledPostErrorCodeTag({errorCode}: Props) {
    return (
        <Tag
            variant={'danger'}
            uppercase={true}
            text={errorCode}
            icon='alert-outline'
        />
    );
}
