// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';

import type {GlobalState} from 'types/store';

type Props = {
    postId: string;
    sectionHeading?: boolean;
};

const RootPostDivider: React.FC<Props> = ({postId, sectionHeading = false}) => {
    const post = useSelector((state: GlobalState) => getPost(state, postId));
    const getThreadOrSynthetic = useMemo(makeGetThreadOrSynthetic, []);

    const totalReplies = useSelector((state: GlobalState) => {
        const thread = getThreadOrSynthetic(state, post);
        return thread.reply_count || 0;
    });

    if (!sectionHeading && totalReplies === 0) {
        return null;
    }

    return (
        <div className={classNames('root-post__divider', {'root-post__divider--section-heading': sectionHeading})}>
            <div>
                {sectionHeading ? (
                    <FormattedMessage
                        id='rhs_post_properties_panel.replies_heading'
                        defaultMessage='Replies'
                    />
                ) : (
                    <FormattedMessage
                        id='threading.numReplies'
                        defaultMessage='{totalReplies, plural, =0 {Reply} =1 {# reply} other {# replies}}'
                        values={{totalReplies}}
                    />
                )}
            </div>
        </div>
    );
};

export default RootPostDivider;
