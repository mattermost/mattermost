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
    min-height: 32px;
    width: 362px;
    height: 32px;

    font-size: 11px;
    line-height: 16px;

    display: flex;
    align-items: center;
    text-align: center;

    color: rgba(var(--center-channel-color, 0.56));

    margin-top: 18px;
`;

export default UpgradeModalFooter;
