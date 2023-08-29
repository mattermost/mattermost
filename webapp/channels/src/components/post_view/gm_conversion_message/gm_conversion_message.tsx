// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Post} from '@mattermost/types/posts';
import {renderUsername} from 'components/post_markdown/system_message_helpers';
import {FormattedMessage, useIntl} from 'react-intl';

type Props = {
    post: Post;
}
function GMConversionMessage(props: Props): JSX.Element {
    const intl = useIntl();

    const convertedByUsername = props.post.props.convertedByUsername;
    const gmMembersDuringConversion = props.post.props.gmMembersDuringConversion as string[];

    if (!convertedByUsername || !gmMembersDuringConversion || gmMembersDuringConversion.length === 0) {
        return (
            <span>{props.post.message}</span>
        );
    }

    const renderedConvertedByUsername = renderUsername(convertedByUsername);
    const gmMembers = gmMembersDuringConversion.map(renderUsername);

    return (
        <FormattedMessage
            id='api.channel.group_message_converted_to.private_channel'
            defaultMessage='{convertedBy} created this channel from a group message with {gmMembers}.'
            values={{
                convertedBy: renderedConvertedByUsername,
                gmMembers: intl.formatList(gmMembers),
            }}
        />
    );
}

export default GMConversionMessage;
