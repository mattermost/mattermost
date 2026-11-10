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
};

/**
 * Tells people who can fix it that this channel lacks a required attribute value.
 * Not dismissible: it goes away when the value is set.
 */
export default function MissingRequiredAttributesNotice({channelId}: Props) {
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
                data-testid='missingRequiredAttributesNotice'
            >
                <AlertCircleOutlineIcon
                    size={16}
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
                    data-testid='missingRequiredAttributesNoticeAddValues'
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
