// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';

import './hidden_by_policy_placeholder.scss';

type Props = {
    postId: string;
};

// HiddenByPolicyPlaceholder renders in place of a post's message when a
// channel Post Policy has blanked the body for the requesting user. It is
// intentionally non-interactive — there is no reveal action because the
// server enforces the policy on every fetch.
function HiddenByPolicyPlaceholder({postId}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div
            className='HiddenByPolicyPlaceholder'
            role='note'
            aria-label={formatMessage({
                id: 'post.hidden_by_policy.aria_label',
                defaultMessage: 'This message is hidden by a channel policy.',
            })}
            data-testid={`hidden-by-policy-${postId}`}
        >
            <div className='HiddenByPolicyPlaceholder__content'>
                <LockOutlineIcon
                    size={12}
                    className='HiddenByPolicyPlaceholder__icon'
                />
                <span className='HiddenByPolicyPlaceholder__text'>
                    {formatMessage({
                        id: 'post.hidden_by_policy.text',
                        defaultMessage: 'Hidden by policy',
                    })}
                </span>
            </div>
        </div>
    );
}

export default memo(HiddenByPolicyPlaceholder);
