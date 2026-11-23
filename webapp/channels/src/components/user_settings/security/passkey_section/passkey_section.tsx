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

const SECTION_PASSKEYS = 'passkeys';

const messages = defineMessages({
    count: {
        id: 'user.settings.passkeys.count',
        defaultMessage: '{count, plural, =0 {No passkeys} one {# passkey} other {# passkeys}}',
        description: 'Summary under the Passkeys heading in Profile > Security when the section is collapsed; {count} is how many passkeys the user has.',
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
    active: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section: string) => void;
};

export default function PasskeySection({visible, active, areAllSectionsInactive, updateSection}: Props) {
    const {formatMessage} = useIntl();
    const minRef = useRef<SettingItemMinComponent>(null);
    const wasActive = useRef(active);
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [serverError, setServerError] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<Passkey | null>(null);

    const load = useCallback(async () => {
        try {
            setPasskeys(await Client4.getPasskeys('me'));
            setServerError(null);
        } catch (e) {
            setServerError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            load();
        }
    }, [visible, load]);

    useEffect(() => {
        if (wasActive.current && !active && areAllSectionsInactive) {
            minRef.current?.focus();
        }
        wasActive.current = active;
    }, [active, areAllSectionsInactive]);

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
                describe={formatMessage(messages.count, {count: passkeys.length})}
                section={SECTION_PASSKEYS}
                updateSection={updateSection}
                ref={minRef}
            />
        );
    }

    const list = passkeys.length === 0 ? (
        <FormattedMessage
            id='user.settings.passkeys.none'
            defaultMessage='You have no passkeys.'
            description='Shown in the expanded Passkeys section when the user has not added any passkey.'
        />
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

    return (
        <>
            <SettingItemMax
                title={title}
                inputs={<div className='pt-2'>{list}</div>}
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
