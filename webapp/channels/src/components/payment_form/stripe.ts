// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
    StripeError,
    ConfirmCardSetupData,
    ConfirmCardSetupOptions,
    SetupIntent,
} from '@stripe/stripe-js';

type ConfirmCardSetupType = (clientSecret: string, data?: ConfirmCardSetupData | undefined, options?: ConfirmCardSetupOptions | undefined) => Promise<{ setupIntent?: SetupIntent | undefined; error?: StripeError | undefined }> | undefined;

function prodConfirmCardSetup(confirmCardSetup: ConfirmCardSetupType): ConfirmCardSetupType {
    return confirmCardSetup;
}

function devConfirmCardSetup(confirmCardSetup: ConfirmCardSetupType): ConfirmCardSetupType {
    return async (clientSecret: string, data?: ConfirmCardSetupData | undefined, options?: ConfirmCardSetupOptions | undefined) => {
        return {setupIntent: {id: 'testid', status: 'succeeded'} as SetupIntent};
    };
}

export const getConfirmCardSetup = (isCwsMockMode?: boolean) => (isCwsMockMode ? devConfirmCardSetup : prodConfirmCardSetup);

export const STRIPE_CSS_SRC = 'https://fonts.googleapis.com/css?family=Open+Sans:400,400i,600,600i&display=swap';
//eslint-disable-next-line no-process-env
export const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY || 'pk_test_ttEpW6dCHksKyfAFzh6MvgBj';
