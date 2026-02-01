// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {E2EEDevice} from '@mattermost/types/e2ee';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import ConfirmModal from 'components/confirm_modal';
import LoadingScreen from 'components/loading_screen';
import Tag from 'components/widgets/tag/tag';

import {getFullName} from 'utils/utils';

import './e2ee_devices_modal.scss';

type Props = {
    user: UserProfile;
    onExited: () => void;
};

export default function E2EEDevicesModal({user, onExited}: Props) {
    const {formatMessage, formatDate} = useIntl();
    const [devices, setDevices] = useState<E2EEDevice[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
    const [deviceToRevoke, setDeviceToRevoke] = useState<E2EEDevice | null>(null);

    const loadDevices = useCallback(async () => {
        try {
            const fetchedDevices = await Client4.getE2EEUserDevices(user.id);
            setDevices(fetchedDevices);
            setError(null);
        } catch (err) {
            setError(formatMessage({
                id: 'admin.e2ee_devices_modal.load_error',
                defaultMessage: 'Failed to load E2EE devices',
            }));
        }
    }, [user.id, formatMessage]);

    useEffect(() => {
        loadDevices();
    }, [loadDevices]);

    const handleRevokeDevice = useCallback(async (deviceId: string) => {
        setDeviceToRevoke(null);
        setRevokingDeviceId(deviceId);
        try {
            await Client4.revokeE2EEDevice(deviceId);
            await loadDevices();
        } catch (err) {
            setError(formatMessage({
                id: 'admin.e2ee_devices_modal.revoke_error',
                defaultMessage: 'Failed to revoke device',
            }));
        } finally {
            setRevokingDeviceId(null);
        }
    }, [formatMessage, loadDevices]);

    const handleConfirmRevoke = useCallback(() => {
        if (deviceToRevoke) {
            handleRevokeDevice(deviceToRevoke.device_id);
        }
    }, [deviceToRevoke, handleRevokeDevice]);

    const formatTimestamp = (timestamp: number) => {
        return formatDate(timestamp, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderDeviceList = () => {
        if (error) {
            return (
                <div className='e2ee-devices-modal__error'>
                    {error}
                </div>
            );
        }

        if (devices === null) {
            return <LoadingScreen/>;
        }

        if (devices.length === 0) {
            return (
                <div className='e2ee-devices-modal__empty'>
                    <FormattedMessage
                        id='admin.e2ee_devices_modal.no_devices'
                        defaultMessage='No E2EE devices found for this user.'
                    />
                </div>
            );
        }

        return (
            <>
                <div className='e2ee-devices-modal__divider'/>
                {devices.map((device) => (
                    <React.Fragment key={device.device_id}>
                        <div className='e2ee-devices-modal__device'>
                            <div className='e2ee-devices-modal__device-info'>
                                <div className='e2ee-devices-modal__device-header'>
                                    <span className='e2ee-devices-modal__device-name'>
                                        {device.device_name || formatMessage({
                                            id: 'admin.e2ee_devices_modal.unnamed_device',
                                            defaultMessage: 'Unnamed device',
                                        })}
                                    </span>
                                    <Tag
                                        icon='shield-alert-outline'
                                        text={formatMessage({
                                            id: 'admin.e2ee_devices_modal.unverified',
                                            defaultMessage: 'Unverified',
                                        })}
                                        size='xs'
                                    />
                                </div>
                                <div className='e2ee-devices-modal__device-timestamps'>
                                    <div>
                                        <span className='e2ee-devices-modal__label'>
                                            <FormattedMessage
                                                id='admin.e2ee_devices_modal.last_active'
                                                defaultMessage='Last active:'
                                            />
                                        </span>
                                        {' '}
                                        {formatTimestamp(device.last_active_at)}
                                    </div>
                                    <div>
                                        <span className='e2ee-devices-modal__label'>
                                            <FormattedMessage
                                                id='admin.e2ee_devices_modal.created'
                                                defaultMessage='Created:'
                                            />
                                        </span>
                                        {' '}
                                        {formatTimestamp(device.created_at)}
                                    </div>
                                </div>
                            </div>
                            <div className='e2ee-devices-modal__device-actions'>
                                <button
                                    className='btn btn-sm btn-tertiary btn-danger'
                                    onClick={() => setDeviceToRevoke(device)}
                                    disabled={revokingDeviceId === device.device_id}
                                >
                                    <FormattedMessage
                                        id='admin.e2ee_devices_modal.revoke_device'
                                        defaultMessage='Revoke device'
                                    />
                                </button>
                            </div>
                        </div>
                        <div className='e2ee-devices-modal__divider'/>
                    </React.Fragment>
                ))}
            </>
        );
    };

    const displayName = getFullName(user) || user.username;
    const modalHeader = formatMessage(
        {
            id: 'admin.e2ee_devices_modal.title',
            defaultMessage: "{name}'s E2EE devices",
        },
        {name: displayName},
    );

    const confirmMessage = deviceToRevoke ? (
        <FormattedMessage
            id='admin.e2ee_devices_modal.revoke_confirm_message'
            defaultMessage="Are you sure you want to revoke {name}'s E2EE device <b>{deviceName}</b>? This action cannot be undone. The device will be removed from all E2EE conversations and will not be able to send or receive any future messages in those conversations.<br></br><br></br><b>Note:</b> The device data will not be removed. If data removal is desired, refer to your Mobile Device Management processes."
            values={{
                deviceName: deviceToRevoke.device_name || formatMessage({
                    id: 'admin.e2ee_devices_modal.unnamed_device',
                    defaultMessage: 'Unnamed device',
                }),
                b: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                br: () => <br/>,
                name: displayName,
            }}
        />
    ) : null;

    return (
        <>
            <GenericModal
                id='e2eeDevicesModal'
                className='e2ee-devices-modal'
                modalHeaderText={modalHeader}
                show={true}
                onHide={onExited}
                compassDesign={true}
            >
                <div className='e2ee-devices-modal__body'>
                    {renderDeviceList()}
                </div>
            </GenericModal>
            <ConfirmModal
                show={deviceToRevoke !== null}
                title={
                    <FormattedMessage
                        id='admin.e2ee_devices_modal.revoke_confirm_title'
                        defaultMessage='Revoke E2EE device?'
                    />
                }
                message={confirmMessage}
                confirmButtonClass='btn btn-danger'
                confirmButtonText={
                    <FormattedMessage
                        id='admin.e2ee_devices_modal.revoke_confirm_button'
                        defaultMessage='Revoke'
                    />
                }
                onConfirm={handleConfirmRevoke}
                onCancel={() => setDeviceToRevoke(null)}
            />
        </>
    );
}
