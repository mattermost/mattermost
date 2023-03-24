import React, {useState} from 'react';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import GenericModal, {DefaultFooterContainer} from 'src/components/widgets/generic_modal';
import {postMessageToAdmins, requestTrialLicense} from 'src/client';
import UpgradeModalFooter from 'src/components/backstage/upgrade_modal_footer';

import {getAdminAnalytics, isCurrentUserAdmin, isTeamEdition} from 'src/selectors';

import {AdminNotificationType} from 'src/constants';
import {isCloud} from 'src/license';
import {useOpenCloudModal} from 'src/hooks';

import {ModalActionState, getUpgradeModalButtons, getUpgradeModalCopy} from 'src/components/backstage/upgrade_modal_data';

import UpgradeModalIllustrationWrapper from 'src/components/backstage/upgrade_modal_illustration';
import UpgradeModalHeader from 'src/components/backstage/upgrade_modal_header';

interface Props {
    messageType: AdminNotificationType;
    show: boolean
    onHide: () => void;
}

const UpgradeModal = (props: Props) => {
    const openCloudModal = useOpenCloudModal();
    const isServerCloud = useSelector(isCloud);
    const isAdmin = useSelector(isCurrentUserAdmin);
    const isServerTeamEdition = useSelector(isTeamEdition);

    const [actionState, setActionState] = useState(ModalActionState.Uninitialized);

    const analytics = useSelector(getAdminAnalytics);
    const serverTotalUsers = analytics?.TOTAL_USERS || 0;

    const requestLicenseSelfHosted = async () => {
        if (actionState === ModalActionState.Loading) {
            return;
        }
        setActionState(ModalActionState.Loading);

        const requestedUsers = Math.max(serverTotalUsers, 30);
        const response = await requestTrialLicense(requestedUsers, props.messageType);
        if (response.error) {
            setActionState(ModalActionState.Error);
        } else {
            setActionState(ModalActionState.Success);
        }
    };

    const openUpgradeModal = async () => {
        if (actionState === ModalActionState.Loading) {
            return;
        }

        props.onHide();

        openCloudModal();
    };

    let adminMainAction = requestLicenseSelfHosted;
    if (isServerCloud) {
        adminMainAction = openUpgradeModal;
    }

    const endUserMainAction = async () => {
        if (actionState === ModalActionState.Loading) {
            return;
        }

        setActionState(ModalActionState.Loading);

        const response = await postMessageToAdmins(props.messageType);
        if (response.error) {
            setActionState(ModalActionState.Error);
        } else {
            setActionState(ModalActionState.Success);
        }
    };

    const copy = getUpgradeModalCopy(isAdmin, isServerTeamEdition, actionState, props.messageType);
    const buttons = getUpgradeModalButtons(isAdmin, isServerTeamEdition, isServerCloud, actionState, adminMainAction, endUserMainAction, props.onHide);

    return (
        <SizedGenericModal
            id={'id'}
            show={props.show}
            modalHeaderText={''}
            onHide={props.onHide}
            confirmButtonText={buttons.confirmButtonText}
            cancelButtonText={buttons.cancelButtonText}
            handleCancel={buttons.handleCancel}
            handleConfirm={buttons.handleConfirm}
            autoCloseOnConfirmButton={false}
            footer={(
                <UpgradeModalFooter
                    actionState={actionState}
                    isCurrentUserAdmin={isAdmin}
                    isServerTeamEdition={isServerTeamEdition}
                    isCloud={isServerCloud}
                />
            )}
            components={{FooterContainer}}
        >
            <Content>
                <UpgradeModalIllustrationWrapper
                    state={actionState}
                />
                <UpgradeModalHeader
                    titleText={copy.titleText}
                    helpText={copy.helpText}
                />
            </Content>
        </SizedGenericModal>
    );
};

const Content = styled.div`
    display: flex;
    flex-direction: column;
`;

const SizedGenericModal = styled(GenericModal)`
    width: 512px;
    height: 404px;
    padding: 0;

    &&&.close {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }

    &&&.GenericModal__button.confirm {
        padding: 13px 20px;
    }

    &&&.modal-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 32px;
        margin-bottom: 48px;
        padding: 0;
    }
`;

const FooterContainer = styled(DefaultFooterContainer)`
    align-items: center;
`;

export default UpgradeModal;
