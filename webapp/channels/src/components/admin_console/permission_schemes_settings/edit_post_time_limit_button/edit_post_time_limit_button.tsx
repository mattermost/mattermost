// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Constants} from 'utils/constants';

type Props = {
    timeLimit: number;
    onClick: () => void;
    isDisabled: boolean | undefined;
}

export default function EditPostTimeLimitButton(props: Props) {
    return (
        <button
            type='button'
            className='edit-post-time-limit-button'
            onClick={props.onClick}
            disabled={props.isDisabled}
        >
            <i className='fa fa-gear'/>
            {props.timeLimit === Constants.UNSET_POST_EDIT_TIME_LIMIT ? (
                <FormattedMessage
                    id='edit_post.time_limit_button.no_limit'
                    defaultMessage='Anytime'
                />
            ) : (
                <FormattedMessage
                    id='edit_post.time_limit_button.for_n_seconds'
                    defaultMessage='For {n} seconds'
                    values={{n: props.timeLimit}}
                />
            )}
        </button>
    );
}
