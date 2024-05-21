// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentType} from 'react';

import useOpenStartTrialFormModal from 'components/common/hooks/useOpenStartTrialFormModal';

export default function withOpenStartTrialFormModal<T>(WrappedComponent: ComponentType<T>) {
    return (props: T) => {
        const openTrialForm = useOpenStartTrialFormModal();
        return (
            <WrappedComponent
                openTrialForm={openTrialForm}
                {...props}
            />
        );
    };
}
