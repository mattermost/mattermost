// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import MentionsIcon from 'components/widgets/icons/mentions_icon';

type Props = {
    name?: string;
    title: MessageDescriptor;
    customID: string;
    isDisabled?: boolean;
    showAtMention: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const GroupProfile = ({
    name,
    title,
    customID,
    isDisabled,
    showAtMention,
    onChange,
}: Props) => (
    <div
        className='group-profile form-horizontal'
        id={customID}
    >
        <div className='group-profile-field form-group mb-0'>
            <label
                className='control-label col-sm-4'
                htmlFor={customID + 'Input'}
            >
                <FormattedMessage {...title}/>
            </label>
            <div className='col-sm-8'>
                <div className='icon-over-input'>
                    {showAtMention && (
                        <MentionsIcon
                            className='icon icon__mentions'
                            aria-hidden='true'
                        />
                    )}
                </div>
                <input
                    id={customID + 'Input'}
                    type='text'
                    className='form-control group-at-mention-input'
                    value={name}
                    disabled={isDisabled}
                    onChange={onChange}
                />
            </div>
        </div>
    </div>
);

export default memo(GroupProfile);
