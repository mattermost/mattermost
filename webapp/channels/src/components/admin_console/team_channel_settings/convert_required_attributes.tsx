// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelPropertyValuePatchItems} from '@mattermost/types/channels';

import type {ChannelAttributeSelection} from 'components/channel_attributes/channel_attributes_form';
import ChannelAttributesForm from 'components/channel_attributes/channel_attributes_form';
import useRequiredChannelAttributesToAsk from 'components/common/hooks/useRequiredChannelAttributesToAsk';

import './convert_required_attributes.scss';

export type PendingChannelAttributeValues = Record<string, string | string[] | null>;

function hasValue(value: string | string[] | null | undefined): boolean {
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

type Props = {
    channelId: string;

    /** The dialog is open for a conversion to private; nothing is fetched otherwise. */
    active: boolean;
    pendingValues?: PendingChannelAttributeValues;
    children: (state: {
        content: React.ReactNode;
        confirmDisabled: boolean;
        values: ChannelPropertyValuePatchItems | undefined;
    }) => React.ReactElement;
};

/**
 * Asks for the required attributes a public channel is still missing before it
 * becomes private, while active. Attributes the caller already has pending edits
 * for count as filled and are not asked again.
 */
const ConvertRequiredAttributes = ({channelId, active, pendingValues, children}: Props) => {
    const toAsk = useRequiredChannelAttributesToAsk({teamId: '', channelId}, {requiredOnly: true, skip: !active});
    const [selection, setSelection] = useState<ChannelAttributeSelection>({});

    // Each opening starts empty.
    useEffect(() => {
        if (!active) {
            setSelection({});
        }
    }, [active]);

    const fields = useMemo(() => (active ? toAsk.fields.filter((field) => !hasValue(pendingValues?.[field.id])) : []), [active, toAsk.fields, pendingValues]);

    const handleChange = useCallback((fieldId: string, value: string | string[] | undefined) => {
        setSelection((current) => {
            const next = {...current};
            if (value === undefined) {
                Reflect.deleteProperty(next, fieldId);
            } else {
                next[fieldId] = value;
            }
            return next;
        });
    }, []);

    const filled = fields.every((field) => hasValue(selection[field.id]));
    const values = fields.length > 0 ? fields.map((field) => ({field_id: field.id, value: selection[field.id]})) : undefined;

    const content = fields.length > 0 ? (
        <div className='ConvertRequiredAttributes'>
            <p className='ConvertRequiredAttributes__intro'>
                <FormattedMessage
                    id='admin.team_channel_settings.convertConfirmModal.missingRequiredAttributes'
                    defaultMessage='This channel has no value for these required attributes:'
                />
            </p>
            <ChannelAttributesForm
                fields={fields}
                values={selection}
                onChange={handleChange}
            />
        </div>
    ) : null;

    return children({
        content,
        confirmDisabled: active && toAsk.enabled && (toAsk.loading || !filled),
        values,
    });
};

export default ConvertRequiredAttributes;
