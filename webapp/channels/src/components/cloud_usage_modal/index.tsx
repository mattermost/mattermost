// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {GenericModal} from '@mattermost/components';
import type {Limits} from '@mattermost/types/cloud';

import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';

import type {Message} from 'utils/i18n';

import WorkspaceLimitsPanel, {messageToElement} from './workspace_limits_panel';

import './index.scss';

interface ModalAction {
    message: Message | React.ReactNode;
    onClick?: () => void;
}
export interface Props {
    title: Message | React.ReactNode;
    description?: Message | React.ReactNode;
    primaryAction?: ModalAction;
    secondaryAction?: ModalAction;
    onClose: () => void;
    ownLimits?: Limits;
    backdrop?: boolean;
    backdropClassName?: string;
    className?: string;
}

export default function CloudUsageModal(props: Props) {
    const [limits] = useGetLimits();
    const usage = useGetUsage();

    return (
        <GenericModal
            handleCancel={props.onClose}
            compassDesign={true}
            onExited={props.onClose}
            modalHeaderText={messageToElement(props.title)}
            cancelButtonText={props.secondaryAction && messageToElement(props.secondaryAction.message)}
            handleConfirm={props.primaryAction?.onClick}
            confirmButtonText={props.primaryAction && messageToElement(props.primaryAction.message)}
            className='CloudUsageModal'
            backdrop={props.backdrop}
            backdropClassName={props.backdropClassName}
        >
            <>
                {React.isValidElement(props.description) ? props.description : <p className='CloudUsageModal__description'>
                    {props.description && messageToElement(props.description)}
                </p>}
                <WorkspaceLimitsPanel
                    showIcons={true}
                    limits={props.ownLimits || limits}
                    usage={usage}
                />
            </>
        </GenericModal>
    );
}
