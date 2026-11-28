// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {openChannelAttributeEditor} from 'actions/views/rhs';

import useFixableMissingRequiredAttributes from 'components/common/hooks/useFixableMissingRequiredAttributes';

import './missing_required_attributes_notice.scss';

type Props = {
    channelId: string;

    // Where the notice sits in the testid tree, e.g. `center.post_list.missing_attributes`; its button is
    // `<testId>.add_values--button`.
    testId?: string;
};

/**
 * Tells people who can fix it that this channel lacks a required attribute value.
 * Not dismissible: it goes away when the value is set. It floats over the top of
 * the message list, beneath the list's own toasts (new messages, calls), which
 * are more urgent and come and go.
 */
export default function MissingRequiredAttributesNotice({channelId, testId}: Props) {
    const dispatch = useDispatch();
    const {fields, firstFieldId} = useFixableMissingRequiredAttributes(channelId);

    const addValues = useCallback(() => {
        if (firstFieldId) {
            dispatch(openChannelAttributeEditor(channelId, firstFieldId));
        }
    }, [dispatch, channelId, firstFieldId]);

    if (fields.length === 0) {
        return null;
    }

    return (
        <div className='MissingRequiredAttributesNotice'>
            <div
                className='MissingRequiredAttributesNotice__pill'
                role='status'
                data-testid={testId}
            >
                <AlertCircleOutlineIcon
                    size={12}
                    aria-hidden={true}
                />
                <span className='MissingRequiredAttributesNotice__text'>
                    <FormattedMessage
                        id='channel_attributes.missing_notice.text'
                        defaultMessage='Channel attribute values are missing'
                    />
                </span>
                <button
                    type='button'
                    className='MissingRequiredAttributesNotice__button'
                    onClick={addValues}
                    data-testid={testId ? `${testId}.add_values--button` : undefined}
                >
                    <FormattedMessage
                        id='channel_attributes.missing_notice.add_values'
                        defaultMessage='Add values'
                    />
                </button>
            </div>
        </div>
    );
}
