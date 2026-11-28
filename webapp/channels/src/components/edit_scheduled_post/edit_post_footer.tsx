// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {isMac} from '@mattermost/shared/utils/user_agent';

import {Preferences} from 'mattermost-redux/constants';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

type Props = {
    onSave: () => void;
    onCancel: () => void;

    testId?: string;
};

const EditPostFooter = ({onSave, onCancel, testId}: Props) => {
    const ctrlSend = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'));
    const ctrlSendKey = isMac() ? '⌘+' : 'CTRL+';

    return (
        <div className='post-body__footer'>
            <button
                onClick={onSave}
                className='save'
                data-testid={testId ? `${testId}.save--button` : undefined}
            >
                <FormattedMessage
                    id='edit_post.action_buttons.save'
                    defaultMessage='Save'
                />
            </button>
            <button
                onClick={onCancel}
                className='cancel'
                data-testid={testId ? `${testId}.cancel--button` : undefined}
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
                    key: ctrlSend ? ctrlSendKey : '',
                    strong: (x) => <strong>{x}</strong>,
                }}
            />
        </div>
    );
};

export default memo(EditPostFooter);
