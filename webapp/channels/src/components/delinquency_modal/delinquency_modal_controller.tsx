// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Subscription} from '@mattermost/types/cloud';
import {PreferenceType} from '@mattermost/types/preferences';
import withGetCloudSubscription from 'components/common/hocs/cloud/with_get_cloud_subscription';
import {ModalData} from 'types/actions';

import {useDelinquencyModalController} from './useDelinquencyModalController';

interface DelinquencyModalControllerProps {
    userIsAdmin: boolean;
    subscription?: Subscription;
    isCloud: boolean;
    actions: {
        getCloudSubscription: () => void;
        closeModal: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
    delinquencyModalPreferencesConfirmed: PreferenceType[];
}

const DelinquencyModalController = (props: DelinquencyModalControllerProps) => {
    useDelinquencyModalController(props);

    return <></>;
};

export default withGetCloudSubscription(DelinquencyModalController);
