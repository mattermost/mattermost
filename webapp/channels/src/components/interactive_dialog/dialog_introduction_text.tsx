// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import Markdown from 'components/markdown';

import {getSiteURL} from 'utils/url';

type Props = {
    value: string;
}

export default function DialogIntroductionText({value}: Props): JSX.Element {
    const siteURL = getSiteURL();
    const markdownOptions = useMemo(() => ({
        breaks: true,
        sanitize: true,
        gfm: true,
        siteURL,
    }), [siteURL]);

    return (
        <Markdown
            message={value}
            options={markdownOptions}
        />
    );
}
