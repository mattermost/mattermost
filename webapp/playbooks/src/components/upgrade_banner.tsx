// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import General from 'mattermost-redux/constants/general';

import {FormattedMessage} from 'react-intl';

import LoadingSpinner from 'src/components/assets/loading_spinner';
import {getAdminAnalytics, isTeamEdition} from 'src/selectors';
import StartTrialNotice from 'src/components/backstage/start_trial_notice';
import ConvertEnterpriseNotice from 'src/components/backstage/convert_enterprise_notice';
import {postMessageToAdmins} from 'src/client';
import {AdminNotificationType} from 'src/constants';
import {isCloud} from 'src/license';
import {useOpenCloudModal, useOpenStartTrialFormModal} from 'src/hooks';

import SuccessSvg from './assets/success_svg';
import ErrorSvg from './assets/error_svg';
import UpgradeIllustrationSvg from './assets/upgrade_illustration_svg';
import {PrimaryButton, SecondaryButton} from './assets/buttons';

enum ActionState {
    Uninitialized,
    Loading,
    Error,
    Success,
}

type HandlerType = undefined | (() => (Promise<void> | void));

const UpgradeWrapper = styled.div`
    position: relative;
    height: 100%;
    text-align: center;
`;

const UpgradeContent = styled.div<{
    vertical?: boolean,
    verticalAdjustment: number,
    horizontalAdjustment?: number,
    svgVerticalAdjustment?: number
}>`
    height: 100%;
    display: flex;
    flex-direction: ${(props) => (props.vertical ? 'column' : 'row')};
    margin-top: -${(props) => props.verticalAdjustment}px;
    align-items: center;
    justify-content: center;

    ${(props) => props.horizontalAdjustment && css`
        svg {
            margin-right: ${props.horizontalAdjustment}px;
        }
    `}

    ${(props) => props.svgVerticalAdjustment && css`
        svg {
            margin-top: -${props.svgVerticalAdjustment}px;
        }
    `}
`;

const InfoContainer = styled.div<{ vertical?: boolean }>`
    display: flex;
    flex-direction: column;
    max-width: 425px;
    align-items: ${(props) => (props.vertical ? 'center' : 'flex-start')};
    text-align: ${(props) => (props.vertical ? 'center' : 'left')};
`;

const Title = styled.div`
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 20px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

const HelpText = styled.div`
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;
    color: var(--center-channel-color);
`;

const FooterContainer = styled.div`
    margin-top: 18px;

    font-weight: 400;
    font-size: 11px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const StyledUpgradeIllustration = styled(UpgradeIllustrationSvg)`
    margin-right: 54px;
    margin-left: 54px;
`;

const UpgradeHeader = styled.div`
    margin-bottom: 14px;
`;

interface Props {
    background: JSX.Element;
    titleText: string;
    helpText: string;
    notificationType: AdminNotificationType;
    verticalAdjustment: number;
    horizontalAdjustment?: number;
    svgVerticalAdjustment?: number;
    vertical?: boolean;
    secondaryButton?: boolean;
}

const UpgradeBanner = (props: Props) => {
    const isServerCloud = useSelector(isCloud);
    const openCloudModal = useOpenCloudModal();
    const currentUser = useSelector(getCurrentUser);
    const isCurrentUserAdmin = isSystemAdmin(currentUser.roles);
    const [actionState, setActionState] = useState(ActionState.Uninitialized);
    const isServerTeamEdition = useSelector(isTeamEdition);
    const openTrialFormModal = useOpenStartTrialFormModal();

    const analytics = useSelector(getAdminAnalytics);
    const serverTotalUsers = analytics?.TOTAL_USERS || 0;

    const endUserMainAction = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        setActionState(ActionState.Loading);

        const response = await postMessageToAdmins(props.notificationType);
        if (response.error) {
            setActionState(ActionState.Error);
        } else {
            setActionState(ActionState.Success);
        }
    };

    const requestLicenseSelfHosted = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        openTrialFormModal('playbooks_upgrade_banner');
    };

    const openUpgradeModal = async () => {
        if (actionState === ActionState.Loading) {
            return;
        }

        openCloudModal();
    };

    let adminMainAction = requestLicenseSelfHosted;
    if (isServerCloud) {
        adminMainAction = openUpgradeModal;
    }

    let titleText: React.ReactNode = props.titleText;
    let helpText: React.ReactNode = props.helpText;
    let stateImage = <StyledUpgradeIllustration/>;

    if (isCurrentUserAdmin && isServerTeamEdition) {
        helpText = <><p>{helpText}</p><ConvertEnterpriseNotice/></>;
    }

    if (actionState === ActionState.Success) {
        stateImage = <SuccessSvg/>;
        titleText = <FormattedMessage defaultMessage='Thank you!'/>;
        helpText = <FormattedMessage defaultMessage='Your System Admin has been notified.'/>;
    }

    if (actionState === ActionState.Error) {
        stateImage = <ErrorSvg/>;
        if (isCurrentUserAdmin) {
            titleText = <FormattedMessage defaultMessage='Your license could not be generated'/>;
            helpText = <FormattedMessage defaultMessage='Please check the system logs for more information.'/>;
        } else {
            titleText = <FormattedMessage defaultMessage='There was an error'/>;
            helpText = <FormattedMessage defaultMessage="We weren't able to notify the System Admin."/>;
        }
    }

    return (
        <UpgradeWrapper>
            {props.background}
            <UpgradeContent
                vertical={props.vertical}
                verticalAdjustment={props.verticalAdjustment}
                horizontalAdjustment={props.horizontalAdjustment}
                svgVerticalAdjustment={props.svgVerticalAdjustment}
            >
                {stateImage}
                <InfoContainer vertical={props.vertical}>
                    <UpgradeHeader>
                        <Title>{titleText}</Title>
                        <HelpText>{helpText}</HelpText>
                    </UpgradeHeader>
                    <Button
                        actionState={actionState}
                        isCurrentUserAdmin={isCurrentUserAdmin}
                        isServerTeamEdition={isServerTeamEdition}
                        endUserMainAction={endUserMainAction}
                        adminMainAction={adminMainAction}
                        isCloud={isServerCloud}
                        secondaryButton={props.secondaryButton}
                    />
                    {!isServerCloud && isCurrentUserAdmin && !isServerTeamEdition && actionState === ActionState.Uninitialized &&
                        <FooterContainer>
                            <StartTrialNotice/>
                        </FooterContainer>
                    }
                </InfoContainer>
            </UpgradeContent>
        </UpgradeWrapper>
    );
};

interface ButtonProps {
    actionState: ActionState;
    isCurrentUserAdmin: boolean;
    isServerTeamEdition: boolean;
    endUserMainAction: HandlerType;
    adminMainAction: HandlerType;
    isCloud: boolean;
    secondaryButton?: boolean;
}

const Button = (props: ButtonProps) => {
    if (props.actionState === ActionState.Loading) {
        return <LoadingSpinner/>;
    }

    if (props.actionState === ActionState.Success) {
        return null;
    }

    const ButtonSC = props.secondaryButton ? SecondaryButton : PrimaryButton;

    if (props.actionState === ActionState.Error) {
        if (props.isCurrentUserAdmin) {
            return (
                <ButtonSC
                    onClick={() => window.open('https://mattermost.com/support/')}
                >
                    <FormattedMessage defaultMessage='Contact support'/>
                </ButtonSC>
            );
        }
        return null;
    }

    if (props.isCurrentUserAdmin && props.isServerTeamEdition) {
        return null;
    }

    let buttonText = <FormattedMessage defaultMessage='Notify System Admin'/>;
    let handleClick: HandlerType = props.endUserMainAction;

    if (props.isCurrentUserAdmin) {
        handleClick = props.adminMainAction;
        buttonText = props.isCloud ? <FormattedMessage defaultMessage='Upgrade now'/> : <FormattedMessage defaultMessage='Start trial'/>;
    }

    return (
        <ButtonSC onClick={handleClick}>
            {buttonText}
        </ButtonSC>
    );
};

const isSystemAdmin = (roles: string): boolean => {
    const rolesArray = roles.split(' ');
    return rolesArray.includes(General.SYSTEM_ADMIN_ROLE);
};

export default UpgradeBanner;
