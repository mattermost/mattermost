// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ContentFlaggingSettings} from '@mattermost/types/config';
import type {DeliveryTrackingConfig} from '@mattermost/types/delivery_tracking';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ContentFlaggingSettingsPage from './content_flagging_settings';

jest.mock('./content_reviewers/content_reviewers', () => ({
    __esModule: true,
    default: () => <div data-testid='content-reviewers'/>,
}));
jest.mock('./notificatin_settings/notification_settings', () => ({
    __esModule: true,
    default: () => <div data-testid='notification-settings'/>,
}));
jest.mock('./additional_settings/additional_settings', () => ({
    __esModule: true,
    default: () => <div data-testid='additional-settings'/>,
}));
jest.mock('./delivery_tracking/delivery_tracking_section', () => ({
    __esModule: true,
    default: ({value, onChange}: {value: DeliveryTrackingConfig; onChange: (v: DeliveryTrackingConfig) => void}) => (
        <div data-testid='delivery-tracking-section'>
            <button
                data-testid='delivery-tracking-enable'
                onClick={() => onChange({...value, Enable: true})}
            >
                {'Enable'}
            </button>
            <button
                data-testid='delivery-tracking-invalidate'
                onClick={() => onChange({Enable: true, EnableForAllChannels: false, ChannelIds: []})}
            >
                {'Invalidate'}
            </button>
        </div>
    ),
}));

const contentFlaggingConfig = {
    EnableContentFlagging: true,
    NotificationSettings: {EventTargetMapping: {}},
    ReviewerSettings: {},
    AdditionalSettings: {},
} as unknown as ContentFlaggingSettings;

const deliveryTrackingConfig: DeliveryTrackingConfig = {
    Enable: false,
    EnableForAllChannels: true,
    ChannelIds: [],
};

function renderPage(flagEnabled: boolean) {
    return renderWithContext(<ContentFlaggingSettingsPage/>, {
        entities: {
            general: {
                config: {
                    FeatureFlagPostDeliveryTracking: flagEnabled ? 'true' : 'false',
                },
            },
        },
    });
}

describe('ContentFlaggingSettings delivery tracking wiring', () => {
    let getContentFlagging: jest.SpyInstance;
    let saveContentFlagging: jest.SpyInstance;
    let getDeliveryTracking: jest.SpyInstance;
    let saveDeliveryTracking: jest.SpyInstance;

    beforeEach(() => {
        getContentFlagging = jest.spyOn(Client4, 'getAdminContentFlaggingConfig').mockResolvedValue(contentFlaggingConfig);
        saveContentFlagging = jest.spyOn(Client4, 'saveContentFlaggingConfig').mockResolvedValue(undefined as never);
        getDeliveryTracking = jest.spyOn(Client4, 'getDeliveryTrackingConfig').mockResolvedValue(deliveryTrackingConfig);
        saveDeliveryTracking = jest.spyOn(Client4, 'saveDeliveryTrackingConfig').mockResolvedValue({status: 'OK'});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should not fetch or render delivery tracking when the feature flag is off', async () => {
        renderPage(false);

        await waitFor(() => expect(getContentFlagging).toHaveBeenCalled());
        expect(getDeliveryTracking).not.toHaveBeenCalled();
        expect(screen.queryByTestId('delivery-tracking-section')).not.toBeInTheDocument();
    });

    test('should fetch and render delivery tracking when the feature flag is on', async () => {
        renderPage(true);

        expect(await screen.findByTestId('delivery-tracking-section')).toBeInTheDocument();
        expect(getDeliveryTracking).toHaveBeenCalled();
    });

    test('should save only the dirty half', async () => {
        renderPage(true);

        await screen.findByTestId('delivery-tracking-section');
        await userEvent.click(screen.getByTestId('delivery-tracking-enable'));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => expect(saveDeliveryTracking).toHaveBeenCalledTimes(1));

        // Content flagging was never edited, so it must not be re-sent.
        expect(saveContentFlagging).not.toHaveBeenCalled();
        expect(saveDeliveryTracking).toHaveBeenCalledWith({...deliveryTrackingConfig, Enable: true});
    });

    test('should keep Save enabled and retry only delivery tracking after it fails', async () => {
        saveDeliveryTracking.mockRejectedValueOnce({message: 'boom'});

        renderPage(true);

        await screen.findByTestId('delivery-tracking-section');
        await userEvent.click(screen.getByTestId('delivery-tracking-enable'));

        const saveButton = screen.getByRole('button', {name: 'Save'});
        await userEvent.click(saveButton);

        await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
        expect(saveButton).toBeEnabled();

        await userEvent.click(saveButton);
        await waitFor(() => expect(saveDeliveryTracking).toHaveBeenCalledTimes(2));
        expect(saveContentFlagging).not.toHaveBeenCalled();
    });

    test('should block the save while delivery tracking is invalid', async () => {
        renderPage(true);

        await screen.findByTestId('delivery-tracking-section');
        await userEvent.click(screen.getByTestId('delivery-tracking-invalidate'));

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        expect(saveContentFlagging).not.toHaveBeenCalled();
        expect(saveDeliveryTracking).not.toHaveBeenCalled();
    });
});
