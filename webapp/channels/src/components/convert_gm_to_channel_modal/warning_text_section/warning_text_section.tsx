// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import SectionNotice from 'components/section_notice';

export type Props = {
    channelMemberNames: string[];
}
const WarningTextSection = (props: Props): JSX.Element => {
    const intl = useIntl();

    let memberNames: string;

    if (props.channelMemberNames.length > 0) {
        memberNames = intl.formatList(props.channelMemberNames);
    } else {
        memberNames = intl.formatMessage({id: 'sidebar_left.sidebar_channel_modal.warning_body_yourself', defaultMessage: 'yourself'});
    }

    return (
        <SectionNotice
            title={intl.formatMessage({
                id: 'sidebar_left.sidebar_channel_modal.warning_header',
                defaultMessage: 'Conversation history will be visible to any channel members',
            })}
            text={intl.formatMessage({
                id: 'sidebar_left.sidebar_channel_modal.warning_body',
                defaultMessage: 'You are about to convert the Group Message with {memberNames} to a Channel. This cannot be undone.',
            },
            {
                memberNames,
            })}
        />
    );
};
export default WarningTextSection;
