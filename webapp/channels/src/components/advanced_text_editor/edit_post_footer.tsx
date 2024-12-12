// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {unsetEditingPost} from 'actions/post_actions';
import {isSendOnCtrlEnter} from 'selectors/preferences';

import {isMac} from 'utils/user_agent';

type Props = {
    onSave: () => void;
    onCancel?: () => void;
}

export default function EditPostFooter(props: Props) {
    const dispatch = useDispatch();

    const sendOnCtrlEnter = useSelector(isSendOnCtrlEnter);
    const ctrlSendKey = isMac() ? '⌘+' : 'CTRL+';

    function handleCancel() {
        props.onCancel?.();
        dispatch(unsetEditingPost());
    }

    return (
        <div className='post-body__footer'>
            <button
                onClick={props.onSave}
                className='save'
            >
                <FormattedMessage
                    id='edit_post.action_buttons.save'
                    defaultMessage='Save'
                />
            </button>
            <button
                onClick={handleCancel}
                className='cancel'
            >
                <FormattedMessage
                    id='edit_post.action_buttons.cancel'
                    defaultMessage='Cancel'
                />
            </button>
            <FormattedMessage
                id='edit_post.helper_text'
                defaultMessage='<strong>{key}ENTER</strong> to Save, <strong>ESC</strong> to Cancel'
                values={{
                    key: sendOnCtrlEnter ? ctrlSendKey : '',
                    strong: (x: string) => <strong>{x}</strong>,
                }}
            />
        </div>
    );
}
