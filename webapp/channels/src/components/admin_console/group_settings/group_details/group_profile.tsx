// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import MentionsIcon from 'components/widgets/icons/mentions_icon';

type Props = {
    name?: string;
    title: string;
    titleDefault: string;
    customID?: string;
    isDisabled?: boolean;
    showAtMention: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export default class GroupProfile extends React.PureComponent<Props> {
    render = () => {
        const {
            name,
            title,
            titleDefault,
            customID,
            isDisabled,
            showAtMention,
            onChange,
        } = this.props;

        return (
            <div
                className='group-profile form-horizontal'
                id={customID}
            >
                <div className='group-profile-field form-group mb-0'>
                    <label className='control-label col-sm-4'>
                        <FormattedMessage
                            id={title}
                            defaultMessage={titleDefault}
                        />
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
    };
}
