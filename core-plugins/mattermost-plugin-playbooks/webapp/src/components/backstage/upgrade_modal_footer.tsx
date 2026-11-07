// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import StartTrialNotice from 'src/components/backstage/start_trial_notice';

import {ModalActionState} from 'src/components/backstage/upgrade_modal_data';

interface Props {
    actionState: ModalActionState;
    isCurrentUserAdmin: boolean;
    isServerTeamEdition: boolean;
    isCloud: boolean;
}

const UpgradeModalFooter = (props: Props) => {
    if (!props.isCurrentUserAdmin) {
        return null;
    }

    if (props.actionState !== ModalActionState.Uninitialized) {
        return null;
    }

    if (props.isServerTeamEdition) {
        return null;
    }

    if (props.isCloud) {
        return null;
    }

    return (
        <FooterContainer>
            <StartTrialNotice/>
        </FooterContainer>
    );
};

const FooterContainer = styled.div`
    display: flex;
    width: 362px;
    height: 32px;
    min-height: 32px;
    align-items: center;
    margin-top: 18px;
    color: rgba(var(--center-channel-color, 0.56));
    font-size: 11px;
    line-height: 16px;
    text-align: center;
`;

export default UpgradeModalFooter;
