// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedDate, FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useLocation} from 'react-router-dom';

import {Button} from '@mattermost/compass-ui/components/button';
import {GenericModal} from '@mattermost/components';
import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {Passkey} from '@mattermost/types/passkeys';

import {Client4} from 'mattermost-redux/client';

import {emitUserLoggedOutEvent} from 'actions/global_actions';
import LocalStorageStore from 'stores/local_storage_store';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {createPasskey, currentSessionCanAddPasskey, signalAcceptedPasskeys, signalUnknownPasskey} from 'utils/passkeys';

const SECTION_PASSKEYS = 'passkeys';
const MAX_PASSKEYS = 10;
const MAX_NAME_LENGTH = 64;

// The server derives the RP ID from the Site URL host and refuses ceremonies from any other origin, so it equals the
// hostname wherever passkeys work.
const rpId = () => window.location.hostname;

const messages = defineMessages({
    count: {
        id: 'user.settings.passkeys.count',
        defaultMessage: '{count, plural, =0 {No passkeys} one {# passkey} other {# passkeys}}',
        description: 'Summary under the Passkeys heading in Profile > Security when the section is collapsed; {count} is how many passkeys the user has.',
    },
    signInAgainHint: {
        id: 'user.settings.passkeys.signInAgainHint',
        defaultMessage: 'To add a passkey, sign in again first.',
        description: 'Shown in place of the add-passkey controls when the current session is too old, or the server refused an add for that reason, to say the user must sign in again before adding a passkey.',
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
    const {pathname} = useLocation();
    const minRef = useRef<SettingItemMinComponent>(null);
    const wasActive = useRef(active);
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [loadFailed, setLoadFailed] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<Passkey | null>(null);

    // Separate from toDelete so the dialog keeps the passkey's name while it fades out.
    const [showDelete, setShowDelete] = useState(false);
    const [name, setName] = useState('');
    const [adding, setAdding] = useState(false);
    const [loginKey] = useState(() => Client4.getCSRFFromCookie());

    // The server refuses an add from a session that did not sign in recently; true once known, from the lookup or a refusal.
    const [signInAgainNeeded, setSignInAgainNeeded] = useState(false);

    const load = useCallback(async (signOutOnUnauthorized = false) => {
        try {
            const list = await Client4.getPasskeys('me');
            setPasskeys(list);
            setLoadFailed(false);
            setServerError(null);
            signalAcceptedPasskeys(rpId(), list);
        } catch (e) {
            // Deleting the passkey this session started with ends the session server-side, so the reload is refused.
            if (signOutOnUnauthorized && (e as {status_code?: number}).status_code === 401) {
                emitUserLoggedOutEvent('/login');
                return;
            }
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
        if (!visible || !canAddPasskey) {
            return undefined;
        }
        let cancelled = false;
        currentSessionCanAddPasskey(loginKey).then((canAdd) => {
            if (!cancelled && !canAdd) {
                setSignInAgainNeeded(true);
            }
        }, () => {
            // The server still enforces the rule; a failed lookup must not lock the user out of adding.
        });
        return () => {
            cancelled = true;
        };
    }, [visible, canAddPasskey, loginKey]);

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
        setShowDelete(false);
        if (!passkey) {
            return;
        }
        try {
            await Client4.deletePasskey('me', passkey.id);
        } catch (e) {
            setServerError((e as Error).message);
            return;
        }

        // signalAcceptedPasskeys never signals an empty list, so this is what removes a last or sole-handle passkey.
        signalUnknownPasskey(rpId(), passkey.credential_id);
        await load(true);
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
            LocalStorageStore.setPasskeyEnrolled(passkey.user_id);
            setName('');
            await load();
        } catch (e) {
            const err = e as Error & {server_error_id?: string};
            if (err.name === 'InvalidStateError') {
                setServerError(formatMessage(messages.alreadyOnDevice));
            } else if (err.server_error_id === 'app.passkey.recent_login_required.app_error') {
                setSignInAgainNeeded(true);
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

    const rows = passkeys.length === 0 ? (
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
                    className='setting-box__item'
                >
                    <div className='d-flex justify-content-between align-items-center'>
                        <div>
                            <strong>{passkey.name}</strong>
                            <div className='light'>
                                <FormattedMessage
                                    id='user.settings.passkeys.created'
                                    defaultMessage='Created {date}'
                                    description='Date a passkey was added, shown on its row in the passkey list; {date} is a formatted date.'
                                    values={{date: <Day value={passkey.create_at}/>}}
                                />
                                {' '}
                                <span aria-hidden='true'>{'·'}</span>
                                {' '}
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
                            size='small'
                            aria-label={formatMessage(messages.deleteLabel, {name: passkey.name})}
                            onClick={() => {
                                setToDelete(passkey);
                                setShowDelete(true);
                            }}
                        >
                            <FormattedMessage
                                id='user.settings.passkeys.delete'
                                defaultMessage='Delete'
                                description='Button on a passkey row that starts deleting that passkey.'
                            />
                        </Button>
                    </div>
                    <hr className='mb-3 mt-3'/>
                </li>
            ))}
        </ul>
    );

    // Nothing to put in the box when the fetch failed and there are no passkeys to show.
    const list = rows && (
        <div className='alert alert-transparent'>
            {rows}
        </div>
    );

    let addControl = null;
    if (canAddPasskey) {
        if (passkeys.length >= MAX_PASSKEYS) {
            addControl = (
                <div className='setting-list__hint pb-3'>
                    <FormattedMessage
                        id='user.settings.passkeys.limit'
                        defaultMessage='You have reached the limit of {max} passkeys. Delete one to add another.'
                        description='Shown instead of the add-passkey control when the user already has the maximum number of passkeys; {max} is that maximum.'
                        values={{max: MAX_PASSKEYS}}
                    />
                </div>
            );
        } else if (signInAgainNeeded) {
            addControl = (
                <div className='pt-3'>
                    <div className='setting-list__hint pb-3'>
                        {formatMessage(messages.signInAgainHint)}
                    </div>
                    <Button
                        emphasis='primary'

                        // Only the pathname: the SAML handler HTML-escapes redirect_to, which would corrupt a second parameter.
                        onClick={() => emitUserLoggedOutEvent('/login?redirect_to=' + encodeURIComponent(pathname + '?action=open_security_settings'))}
                    >
                        <FormattedMessage
                            id='user.settings.passkeys.signInAgain'
                            defaultMessage='Sign in again'
                            description='Button in Profile > Security that signs the user out so they can sign back in and then add a passkey.'
                        />
                    </Button>
                </div>
            );
        } else {
            addControl = (
                <div className='pt-3'>
                    <div className='row'>
                        <label
                            htmlFor='passkeyName'
                            className='col-sm-auto control-label pr-3'
                        >
                            {formatMessage(messages.nameLabel)}
                        </label>
                        <div className='col-sm-5'>
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
                        </div>
                    </div>
                    <div className='setting-list__hint pb-3'>
                        <FormattedMessage
                            id='user.settings.passkeys.nameHelp'
                            defaultMessage='Leave blank to name it after this browser'
                            description='Help text under the passkey name field: an empty name makes the server name the passkey after the browser.'
                        />
                    </div>
                    <Button
                        emphasis='primary'
                        disabled={adding}
                        loading={adding}
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
    }

    return (
        <>
            <SettingItemMax
                title={title}
                inputs={
                    <div className='pt-2'>
                        {list}
                        {addControl}
                    </div>
                }
                extraInfo={
                    <FormattedMessage
                        id='user.settings.passkeys.description'
                        defaultMessage='Passkeys let you sign in with your fingerprint, face, screen lock or a security key instead of your password.'
                        description='Introduction at the top of the expanded Passkeys section in Profile > Security.'
                    />
                }
                infoPosition='top'
                isFullWidth={true}
                serverError={serverError}
                updateSection={updateSection}
                cancelButtonText={
                    <FormattedMessage
                        id='user.settings.security.close'
                        defaultMessage='Close'
                    />
                }
            />
            <GenericModal
                id='deletePasskeyModal'
                compassDesign={true}
                show={showDelete}
                isConfirmDisabled={!showDelete}
                modalHeaderText={
                    <FormattedMessage
                        id='user.settings.passkeys.deleteTitle'
                        defaultMessage='Delete passkey?'
                        description='Title of the confirmation dialog for deleting a passkey.'
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
                autoCloseOnConfirmButton={false}
                handleConfirm={confirmDelete}
                handleCancel={() => setShowDelete(false)}
                onHide={() => setShowDelete(false)}
                onExited={() => setToDelete(null)}
            >
                <p>
                    <FormattedMessage
                        id='user.settings.passkeys.deleteMessage'
                        defaultMessage={'You will no longer be able to sign in with "{name}". Any session started with it will be signed out, including this one if you signed in with it.'}
                        description='Body of the confirmation dialog for deleting a passkey; {name} is the passkey name. Every session the passkey started is ended; the dialog does not know whether the current one is among them, so the text covers both cases.'
                        values={{name: toDelete?.name}}
                    />
                </p>
                {!isDesktopApp() && typeof window.PublicKeyCredential?.signalUnknownCredential === 'function' && (
                    <p>
                        <FormattedMessage
                            id='user.settings.passkeys.deleteForgetOnDevice'
                            defaultMessage={'If it\'s saved on this device, we\'ll ask your browser to remove it too.'}
                            description='Second sentence of the passkey delete dialog, shown only in browsers that can be asked to remove a passkey; the browser may ignore the request.'
                        />
                    </p>
                )}
            </GenericModal>
        </>
    );
}
