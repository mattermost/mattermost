// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelPropertyValuePatchItems} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AlertBanner from 'components/alert_banner';
import {hasEditor} from 'components/channel_attributes/channel_attribute_editor_support';
import type {ChannelAttributeSelection} from 'components/channel_attributes/channel_attributes_form';
import ChannelAttributesForm from 'components/channel_attributes/channel_attributes_form';
import useRequiredChannelAttributesToAsk from 'components/common/hooks/useRequiredChannelAttributesToAsk';

import type {KindMessages} from 'utils/channel_kind';
import Constants from 'utils/constants';

import type {ChannelKind} from 'types/store/plugins';

import './unarchive_channel_modal.scss';

export type ChannelDetailsActions = {
    unarchiveChannel: (channelId: string, propertyValues?: ChannelPropertyValuePatchItems) => Promise<ActionResult>;
};

type Props = {
    onExited: () => void;
    channel: Channel;

    /** The kind of channel, so the modal says "board" rather than "channel" for a board. */
    channelKind?: ChannelKind;
    actions: ChannelDetailsActions;
};

function hasValue(value: string | string[] | undefined): boolean {
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export default function UnarchiveChannelModal({onExited, channel, channelKind = 'channel', actions}: Props) {
    const {formatMessage} = useIntl();
    const [show, setShow] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | undefined>();
    const [selection, setSelection] = useState<ChannelAttributeSelection>({});

    // Required attributes the channel is still missing. The server refuses the
    // restore without values for the ones the person can set, so those are asked
    // for here; the ones they can't set only get a notice.
    const toAsk = useRequiredChannelAttributesToAsk({teamId: channel.team_id, channelId: channel.id}, {requiredOnly: true});
    const {fields, cannotSet} = toAsk;

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

    const filled = useMemo(() => fields.every((field) => hasValue(selection[field.id])), [fields, selection]);
    const asking = fields.length > 0;

    // Only fields with an editor reach the channel admins' message; promising
    // one for the rest would be untrue.
    const flagged = cannotSet.some(hasEditor);

    // Confirm is ignored until the lookup finishes, or Enter on the autofocused
    // button would restore before the missing values are known. The button stays
    // enabled meanwhile: a disabled button can't take autofocus.
    const handleUnarchive = async () => {
        if ((toAsk.enabled && toAsk.loading) || channel.id.length !== Constants.CHANNEL_ID_LENGTH) {
            return;
        }

        setSubmitting(true);
        setServerError(undefined);

        const result = asking ? await actions.unarchiveChannel(
            channel.id,
            fields.map((field) => ({field_id: field.id, value: selection[field.id]})),
        ) : await actions.unarchiveChannel(channel.id);
        if (result.error) {
            setServerError(result.error.message);
            setSubmitting(false);
            return;
        }

        setShow(false);
    };

    const handleHide = () => {
        setShow(false);
    };

    let errorText: string | undefined = serverError;
    if (serverError !== undefined && asking) {
        errorText = formatMessage({
            id: 'unarchive_channel.error',
            defaultMessage: 'We couldn\'t unarchive the channel. {message}',
        }, {message: serverError});
    }

    return (
        <GenericModal
            id='unarchiveChannelModal'
            className='a11y__modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            ariaLabel='unarchive_channel_modal'
            modalHeaderText={<FormattedMessage {...messages.title[channelKind]}/>}
            handleCancel={handleHide}
            handleConfirm={handleUnarchive}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={submitting || (toAsk.enabled && !filled)}
            destructive={true}
            autoFocusConfirmButton={!asking}
            confirmButtonText={asking ? (
                <FormattedMessage
                    id='unarchive_channel.set_and_unarchive'
                    defaultMessage='Set and unarchive'
                />
            ) : (
                <FormattedMessage
                    id='unarchive_channel.del'
                    defaultMessage='Unarchive'
                />
            )}
            cancelButtonText={(
                <FormattedMessage
                    id='unarchive_channel.cancel'
                    defaultMessage='Cancel'
                />
            )}
            errorText={errorText}
            compassDesign={true}
        >
            <div className='alert alert-danger'>
                <FormattedMessage
                    {...messages.question[channelKind]}
                    values={{
                        display_name: channel.display_name,
                        b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                    }}
                />
            </div>
            {asking && (
                <div
                    className='UnarchiveChannelModal__attributes'
                    data-testid='unarchiveChannelModalRequiredAttributes'
                >
                    <p className='UnarchiveChannelModal__attributesIntro'>
                        <FormattedMessage
                            id='unarchive_channel.required_attributes.intro'
                            defaultMessage='This channel has no value for these required attributes:'
                        />
                    </p>
                    <ChannelAttributesForm
                        fields={fields}
                        values={selection}
                        onChange={handleChange}
                        disabled={submitting}
                    />
                </div>
            )}
            {flagged && (
                <AlertBanner
                    id='unarchiveChannelModalFlaggedNotice'
                    mode='info'
                    message={(
                        <FormattedMessage
                            id='unarchive_channel.flagged_notice'
                            defaultMessage={'You can\'t set some required attributes on this channel. Channel admins who can set them will be notified after you unarchive it.'}
                        />
                    )}
                />
            )}
        </GenericModal>
    );
}

/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
const messages = {
    title: {
        channel: defineMessage({
            id: 'unarchive_channel.confirm',
            defaultMessage: 'Confirm UNARCHIVE Channel',
        }),
        board: defineMessage({
            id: 'unarchive_channel.confirm.board',
            defaultMessage: 'Confirm UNARCHIVE Board',
        }),
    },
    question: {
        channel: defineMessage({
            id: 'unarchiveChannelModal.viewArchived.question',
            defaultMessage: 'Are you sure you wish to unarchive the <b>{display_name}</b> channel?',
        }),
        board: defineMessage({
            id: 'unarchiveChannelModal.viewArchived.question.board',
            defaultMessage: 'Are you sure you wish to unarchive the <b>{display_name}</b> board?',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */
