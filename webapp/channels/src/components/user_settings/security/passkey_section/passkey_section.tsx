// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedDate, FormattedMessage, defineMessages, useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import type {Passkey} from '@mattermost/types/passkeys';

import {Client4} from 'mattermost-redux/client';

import ConfirmModal from 'components/confirm_modal';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {createPasskey} from 'utils/passkeys';

const SECTION_PASSKEYS = 'passkeys';
const MAX_PASSKEYS = 10;
const MAX_NAME_LENGTH = 64;

const messages = defineMessages({
    count: {
        id: 'user.settings.passkeys.count',
        defaultMessage: '{count, plural, =0 {No passkeys} one {# passkey} other {# passkeys}}',
        description: 'Summary under the Passkeys heading in Profile > Security when the section is collapsed; {count} is how many passkeys the user has.',
    },
    recentLogin: {
        id: 'user.settings.passkeys.recentLoginRequired',
        defaultMessage: 'For your security, sign out and sign back in, then add your passkey within 10 minutes.',
        description: 'Error shown when adding a passkey is refused because the user did not sign in recently enough.',
    },
    alreadyOnDevice: {
        id: 'user.settings.passkeys.alreadyOnDevice',
        defaultMessage: 'This device already has a passkey for your account.',
        description: 'Error shown when the browser reports that the chosen authenticator already holds a passkey for this account.',
    },
    nameLabel: {
        id: 'user.settings.passkeys.nameLabel',
        defaultMessage: 'Passkey name',
        description: 'Label of the optional text field naming a passkey that is about to be added.',
    },
    namePlaceholder: {
        id: 'user.settings.passkeys.namePlaceholder',
        defaultMessage: 'e.g. Work laptop',
        description: 'Placeholder in the passkey name field; the example is a name a user might give a passkey.',
    },
    deleteLabel: {
        id: 'user.settings.passkeys.deleteLabel',
        defaultMessage: 'Delete passkey {name}',
        description: 'Accessible name of the Delete button on one row of the passkey list; {name} is the passkey name the user gave it.',
    },
});

const Day = ({value}: {value: number}) => (
    <FormattedDate
        value={value}
        year='numeric'
        month='short'
        day='numeric'
    />
);

type Props = {
    visible: boolean;
    canAddPasskey: boolean;
    active: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section: string) => void;
};

export default function PasskeySection({visible, canAddPasskey, active, areAllSectionsInactive, updateSection}: Props) {
    const {formatMessage} = useIntl();
    const minRef = useRef<SettingItemMinComponent>(null);
    const wasActive = useRef(active);
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [loadFailed, setLoadFailed] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<Passkey | null>(null);
    const [name, setName] = useState('');
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        try {
            setPasskeys(await Client4.getPasskeys('me'));
            setLoadFailed(false);
            setServerError(null);
        } catch (e) {
            setLoadFailed(true);
            setServerError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            load();
        }
    }, [visible, load]);

    useEffect(() => {
        if (!active) {
            setServerError(null);
        } else if (!wasActive.current) {
            // Collapsing clears serverError, so re-fetch on expand: a still-failing fetch shows its error again instead of an empty list.
            load();
        }
        if (wasActive.current && !active && areAllSectionsInactive) {
            minRef.current?.focus();
        }
        wasActive.current = active;
    }, [active, areAllSectionsInactive, load]);

    const confirmDelete = async () => {
        const passkey = toDelete;
        setToDelete(null);
        if (!passkey) {
            return;
        }
        try {
            await Client4.deletePasskey('me', passkey.id);
        } catch (e) {
            setServerError((e as Error).message);
            return;
        }
        await load();
    };

    const addPasskey = async () => {
        setAdding(true);
        setServerError(null);
        try {
            const passkey = await createPasskey(
                () => Client4.beginPasskeyRegistration('me'),
                (ceremonyId, credential) => Client4.finishPasskeyRegistration('me', ceremonyId, name.trim(), credential),
            );
            if (!passkey) {
                return;
            }
            setName('');
            await load();
        } catch (e) {
            const err = e as Error & {server_error_id?: string};
            if (err.name === 'InvalidStateError') {
                setServerError(formatMessage(messages.alreadyOnDevice));
            } else if (err.server_error_id === 'app.passkey.recent_login_required.app_error') {
                setServerError(formatMessage(messages.recentLogin));
            } else {
                setServerError(err.message);
            }
        } finally {
            setAdding(false);
        }
    };

    if (!visible) {
        return null;
    }

    const title = (
        <FormattedMessage
            id='user.settings.passkeys.title'
            defaultMessage='Passkeys'
            description='Heading of the Passkeys section in Profile > Security.'
        />
    );

    if (!active) {
        return (
            <SettingItemMin
                title={title}
                describe={loadFailed ? undefined : formatMessage(messages.count, {count: passkeys.length})}
                section={SECTION_PASSKEYS}
                updateSection={updateSection}
                ref={minRef}
            />
        );
    }

    const list = passkeys.length === 0 ? (
        !loadFailed && (
            <FormattedMessage
                id='user.settings.passkeys.none'
                defaultMessage='You have no passkeys.'
                description='Shown in the expanded Passkeys section when the user has not added any passkey.'
            />
        )
    ) : (
        <ul className='list-unstyled'>
            {passkeys.map((passkey) => (
                <li
                    key={passkey.id}
                    className='d-flex justify-content-between align-items-center pb-2'
                >
                    <div>
                        <strong>{passkey.name}</strong>
                        <div>
                            <FormattedMessage
                                id='user.settings.passkeys.created'
                                defaultMessage='Created {date}'
                                description='Date a passkey was added, shown on its row in the passkey list; {date} is a formatted date.'
                                values={{date: <Day value={passkey.create_at}/>}}
                            />
                        </div>
                        <div>
                            {passkey.last_used_at === 0 ? (
                                <FormattedMessage
                                    id='user.settings.passkeys.neverUsed'
                                    defaultMessage='Never used'
                                    description='Shown on a passkey row when the passkey has never been used to sign in.'
                                />
                            ) : (
                                <FormattedMessage
                                    id='user.settings.passkeys.lastUsed'
                                    defaultMessage='Last used {date}'
                                    description='Date a passkey was last used to sign in, shown on its row in the passkey list; {date} is a formatted date.'
                                    values={{date: <Day value={passkey.last_used_at}/>}}
                                />
                            )}
                        </div>
                    </div>
                    <Button
                        emphasis='tertiary'
                        aria-label={formatMessage(messages.deleteLabel, {name: passkey.name})}
                        onClick={() => setToDelete(passkey)}
                    >
                        <FormattedMessage
                            id='user.settings.passkeys.delete'
                            defaultMessage='Delete'
                            description='Button on a passkey row that starts deleting that passkey.'
                        />
                    </Button>
                </li>
            ))}
        </ul>
    );

    let addControl = null;
    if (canAddPasskey) {
        addControl = passkeys.length >= MAX_PASSKEYS ? (
            <p>
                <FormattedMessage
                    id='user.settings.passkeys.limit'
                    defaultMessage='You have reached the limit of {max} passkeys. Delete one to add another.'
                    description='Shown instead of the add-passkey control when the user already has the maximum number of passkeys; {max} is that maximum.'
                    values={{max: MAX_PASSKEYS}}
                />
            </p>
        ) : (
            <div className='pb-3'>
                <label
                    htmlFor='passkeyName'
                    className='control-label'
                >
                    {formatMessage(messages.nameLabel)}
                </label>
                <input
                    id='passkeyName'
                    className='form-control'
                    type='text'
                    maxLength={MAX_NAME_LENGTH}
                    placeholder={formatMessage(messages.namePlaceholder)}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={adding}
                />
                <div className='setting-list__hint'>
                    <FormattedMessage
                        id='user.settings.passkeys.nameHelp'
                        defaultMessage='Leave blank to name it after this browser'
                        description='Help text under the passkey name field: an empty name makes the server name the passkey after the browser.'
                    />
                </div>
                <Button
                    emphasis='secondary'
                    disabled={adding}
                    onClick={addPasskey}
                >
                    <FormattedMessage
                        id='user.settings.passkeys.add'
                        defaultMessage='Add passkey'
                        description='Button that starts adding a new passkey to the account.'
                    />
                </Button>
            </div>
        );
    }

    return (
        <>
            <SettingItemMax
                title={title}
                inputs={
                    <div className='pt-2'>
                        {addControl}
                        {list}
                    </div>
                }
                serverError={serverError}
                updateSection={updateSection}
                cancelButtonText={
                    <FormattedMessage
                        id='user.settings.security.close'
                        defaultMessage='Close'
                    />
                }
            />
            <ConfirmModal
                show={toDelete !== null}
                title={
                    <FormattedMessage
                        id='user.settings.passkeys.deleteTitle'
                        defaultMessage='Delete passkey?'
                        description='Title of the confirmation dialog for deleting a passkey.'
                    />
                }
                message={
                    <FormattedMessage
                        id='user.settings.passkeys.deleteMessage'
                        defaultMessage={'You will no longer be able to sign in with "{name}". This doesn\'t sign you out anywhere.'}
                        description='Body of the confirmation dialog for deleting a passkey; {name} is the passkey name.'
                        values={{name: toDelete?.name}}
                    />
                }
                confirmButtonText={
                    <FormattedMessage
                        id='user.settings.passkeys.deleteConfirm'
                        defaultMessage='Delete'
                        description='Confirm button of the dialog for deleting a passkey.'
                    />
                }
                destructive={true}
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
            />
        </>
    );
}
