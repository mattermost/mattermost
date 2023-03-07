// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Markdown from 'components/markdown';

type Props = {
    id?: string;
    value: string;
};

const markdownOptions = {singleline: false, mentionHighlight: false};

const AppsFormHeader: React.FC<Props> = (props: Props) => {
    return (
        <Markdown
            message={props.value}
            options={markdownOptions}
        />
    );
};

export default AppsFormHeader;
