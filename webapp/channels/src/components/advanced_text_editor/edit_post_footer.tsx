// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {isMac} from '@mattermost/shared/utils/user_agent';

import {unsetEditingPost} from 'actions/post_actions';
import {isSendOnCtrlEnter} from 'selectors/preferences';

import type {GlobalState} from 'types/store';

type Props = {
    onSave: () => void;
    onCancel?: () => void;
    disabled?: boolean;
};

export default function EditPostFooter(props: Props) {
    const dispatch = useDispatch();

    const sendOnCtrlEnter = useSelector(isSendOnCtrlEnter);
    const editingPostRefocusId = useSelector((state: GlobalState) => state.views.posts.editingPost.refocusId);
    const ctrlSendKey = isMac() ? '⌘+' : 'CTRL+';

    function handleCancel() {
        props.onCancel?.();

        // Refocus the textbox the edit started from, as saving the edit does
        if (editingPostRefocusId) {
            document.getElementById(editingPostRefocusId)?.focus();
        }
        dispatch(unsetEditingPost());
    }

    return (
        <div className='post-body__footer'>
            <button
                onClick={props.onSave}
                className='save'
                disabled={props.disabled}
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
                    strong: (x) => <strong>{x}</strong>,
                }}
            />
        </div>
    );
}
