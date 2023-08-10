// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {Constants} from 'utils/constants';
import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';

import type {AdminConfig} from '@mattermost/types/config';
import type {ActionFunc} from 'mattermost-redux/types/actions';

const INT32_MAX = 2147483647;

type Props ={
    config: Partial<AdminConfig>;
    show: boolean;
    onClose: () => void;
    actions: {
        updateConfig: (config: AdminConfig) => ActionFunc & {error?: ClientErrorPlaceholder};
    };
}

type ClientErrorPlaceholder = {
    message: string;
    server_error_id: string;
}

export default function EditPostTimeLimitModal(props: Props) {
    const {ServiceSettings} = props.config;

    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [postEditTimeLimit, setPostEditTimeLimit] = useState<number>(ServiceSettings?.PostEditTimeLimit || Constants.UNSET_POST_EDIT_TIME_LIMIT);
    const [alwaysAllowPostEditing, setAlwaysAllowPostEditing] = useState(postEditTimeLimit < 0);

    const save = async () => {
        setSaving(true);
        setErrorMessage('');

        if (isNaN(postEditTimeLimit) || postEditTimeLimit < 0 || postEditTimeLimit > INT32_MAX) {
            setErrorMessage(localizeMessage('edit_post.time_limit_modal.invalid_time_limit', 'Invalid time limit'));
            setSaving(false);
            setPostEditTimeLimit(0);
            return false;
        }

        const newConfig = JSON.parse(JSON.stringify(props.config));
        newConfig.ServiceSettings.PostEditTimeLimit = alwaysAllowPostEditing ? Constants.UNSET_POST_EDIT_TIME_LIMIT : postEditTimeLimit;

        const {error} = await props.actions.updateConfig(newConfig);
        if (error) {
            setErrorMessage(error.message);
            setSaving(false);
        } else {
            setSaving(false);
            props.onClose();
        }

        return true;
    };

    const handleOptionChange = ({currentTarget}: React.FormEvent<HTMLInputElement>) => {
        setAlwaysAllowPostEditing(currentTarget.value === Constants.ALLOW_EDIT_POST_ALWAYS);
    };

    const handleSecondsChange = ({currentTarget}: React.FormEvent<HTMLInputElement>) => setPostEditTimeLimit(parseInt(currentTarget.value, 10));

    return (
        <Modal
            dialogClassName='a11y__modal admin-modal edit-post-time-limit-modal'
            show={props.show}
            role='dialog'
            aria-labelledby='editPostTimeModalLabel'
            onHide={props.onClose}
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='editPostTimeModalLabel'
                >
                    <FormattedMessage
                        id='edit_post.time_limit_modal.title'
                        defaultMessage='Configure Global Edit Post Time Limit'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <FormattedMarkdownMessage
                    id='edit_post.time_limit_modal.description'
                    defaultMessage='Setting a time limit **applies to all users** who have the "Edit Post" permissions in any permission scheme.'
                />
                <div className='pl-3 pb-3 pt-3'>
                    <div className='pt-3'>
                        <input
                            id='anytime'
                            type='radio'
                            name='limit'
                            value={Constants.ALLOW_EDIT_POST_ALWAYS}
                            checked={alwaysAllowPostEditing}
                            onChange={handleOptionChange}
                        />
                        <label htmlFor='anytime'>
                            <FormattedMessage
                                id='edit_post.time_limit_modal.option_label_anytime'
                                defaultMessage='Anytime'
                            />
                        </label>
                    </div>
                    <div className='pt-2'>
                        <input
                            id='timelimit'
                            type='radio'
                            name='limit'
                            value={Constants.ALLOW_EDIT_POST_TIME_LIMIT}
                            checked={!alwaysAllowPostEditing}
                            onChange={handleOptionChange}
                        />
                        <label htmlFor='timelimit'>
                            <FormattedMessage
                                id='edit_post.time_limit_modal.option_label_time_limit.preinput'
                                defaultMessage='Can edit for'
                            />
                        </label>
                        <input
                            type='number'
                            className='form-control inline'
                            min='0'
                            step='1'
                            max={INT32_MAX}
                            id='editPostTimeLimit'
                            readOnly={alwaysAllowPostEditing}
                            onChange={handleSecondsChange}
                            value={alwaysAllowPostEditing ? '' : postEditTimeLimit}
                        />
                        <label htmlFor='timelimit'>
                            <FormattedMessage
                                id='edit_post.time_limit_modal.option_label_time_limit.postinput'
                                defaultMessage='seconds after posting'
                            />
                        </label>
                    </div>
                    <div className='pt-3 light'>
                        <FormattedMessage
                            id='edit_post.time_limit_modal.subscript'
                            defaultMessage='Set the length of time users have to edit their messages after posting.'
                        />
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className='edit-post-time-limit-modal__error'>
                    {errorMessage}
                </div>
                <button
                    type='button'
                    className='btn btn-cancel'
                    onClick={props.onClose}
                >
                    <FormattedMessage
                        id='confirm_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    id='linkModalCloseButton'
                    type='button'
                    className='btn btn-default'
                    onClick={save}
                    disabled={saving}
                >
                    <FormattedMessage
                        id={saving ? t('save_button.saving') : t('edit_post.time_limit_modal.save_button')}
                        defaultMessage='Save Edit Time'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
}
