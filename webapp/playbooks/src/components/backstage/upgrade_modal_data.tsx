import React from 'react';

import {DateTime} from 'luxon';

import {FormattedMessage} from 'react-intl';

import styled from 'styled-components';

import ConvertEnterpriseNotice from 'src/components/backstage/convert_enterprise_notice';

import LoadingSpinner from 'src/components/assets/loading_spinner';

import {AdminNotificationType} from 'src/constants';

type HandlerType = undefined | (() => (Promise<void> | void));

export interface ModalContents {
    titleText: React.ReactNode;
    helpText: React.ReactNode;
}

export enum ModalActionState {
    Uninitialized,
    Loading,
    Error,
    Success,
}

export interface UpgradeModalButtons {
    confirmButtonText : React.ReactNode;
    cancelButtonText : React.ReactNode;
    handleConfirm : HandlerType;
    handleCancel : HandlerType;
}

export const getUpgradeModalButtons = (isAdmin: boolean, isServerTeamEdition: boolean, isCloud: boolean, state: ModalActionState, adminMainAction: () => void, endUserMainAction: () => void, onHide: () => void) : UpgradeModalButtons => {
    if (isServerTeamEdition && isAdmin) {
        return {
            confirmButtonText: '',
            cancelButtonText: '',
            // eslint-disable-next-line no-undefined
            handleConfirm: undefined,
            // eslint-disable-next-line no-undefined
            handleCancel: undefined,
        };
    }

    switch (state) {
    case ModalActionState.Uninitialized:
        if (isAdmin) {
            const confirmButtonText = isCloud ? <FormattedMessage defaultMessage='Upgrade now'/> : <FormattedMessage defaultMessage='Start trial'/>;

            return {
                confirmButtonText,
                cancelButtonText: <FormattedMessage defaultMessage='Not right now'/>,
                handleConfirm: adminMainAction,
                handleCancel: onHide,
            };
        }
        return {
            confirmButtonText: <FormattedMessage defaultMessage='Notify System Admin'/>,
            cancelButtonText: <FormattedMessage defaultMessage='Not right now'/>,
            handleConfirm: endUserMainAction,
            handleCancel: onHide,
        };

    case ModalActionState.Loading:
        return {
            confirmButtonText: '',
            cancelButtonText: <LoadingSpinner/>,
            // eslint-disable-next-line no-undefined
            handleConfirm: undefined,
            handleCancel: () => { /*do nothing*/ },
        };

    case ModalActionState.Success:
        return {
            confirmButtonText: <FormattedMessage defaultMessage='Done'/>,
            cancelButtonText: '',
            handleConfirm: onHide,
            // eslint-disable-next-line no-undefined
            handleCancel: undefined,
        };

    default:
        if (isAdmin) {
            return {
                confirmButtonText: <FormattedMessage defaultMessage='Contact support'/>,
                cancelButtonText: '',
                handleConfirm: () => {
                    window.open('https://mattermost.com/support/');
                },
                // eslint-disable-next-line no-undefined
                handleCancel: undefined,
            };
        }

        return {
            confirmButtonText: <FormattedMessage defaultMessage='Done'/>,
            cancelButtonText: '',
            handleConfirm: onHide,
            // eslint-disable-next-line no-undefined
            handleCancel: undefined,
        };
    }
};

const PortalLink = styled.a.attrs(() => {
    return {
        href: 'https://customers.mattermost.com/signup',
        target: '_blank',
        rel: 'noreferrer',
    };
})``;

export const getUpgradeModalCopy = (
    isAdmin: boolean,
    isServerTeamEdition: boolean,
    state: ModalActionState,
    messageType: AdminNotificationType,
): ModalContents => {
    let titleText: React.ReactNode = '';
    let helpText: React.ReactNode = '';

    switch (state) {
    case ModalActionState.Success:
        if (isAdmin) {
            const expiryDate = DateTime.now().plus({days: 30}).toLocaleString(DateTime.DATE_FULL);
            return {
                titleText: <FormattedMessage defaultMessage='Your 30-day trial has started'/>,
                helpText: (
                    <span>
                        <FormattedMessage
                            defaultMessage='Your trial license expires on {expiryDate}. You can purchase a license at any time through the <PortalLink>Customer Portal</PortalLink> to avoid any disruption.'
                            values={{expiryDate, PortalLink}}
                        />
                    </span>
                ),
            };
        }

        return {
            titleText: <FormattedMessage defaultMessage='Thank you!'/>,
            helpText: <FormattedMessage defaultMessage='Your System Admin has been notified'/>,
        };

    case ModalActionState.Uninitialized:
    case ModalActionState.Loading:
        switch (messageType) {
        case AdminNotificationType.VIEW_TIMELINE:
        case AdminNotificationType.MESSAGE_TO_TIMELINE:
            titleText = <FormattedMessage defaultMessage='Add more to your timeline'/>;
            helpText = <FormattedMessage defaultMessage='Save important messages for a complete picture that streamlines retrospectives.'/>;
            break;
        case AdminNotificationType.PLAYBOOK_GRANULAR_ACCESS:
            titleText = <FormattedMessage defaultMessage='Put your team in control'/>;
            helpText = <FormattedMessage defaultMessage='Manage permission for who can view, modify, and run this playbook.'/>;
            break;
        case AdminNotificationType.PLAYBOOK_CREATION_RESTRICTION:
            titleText = <FormattedMessage defaultMessage='Put your team in control'/>;
            helpText = <FormattedMessage defaultMessage="Every team's structure is different. You can manage which users in the team can create playbooks."/>;
            break;
        case AdminNotificationType.EXPORT_CHANNEL:
            titleText = <FormattedMessage defaultMessage='Save your playbook run history'/>;
            helpText = <FormattedMessage defaultMessage='Export the playbook run channel and save it for later analysis.'/>;
            break;
        case AdminNotificationType.PLAYBOOK_METRICS:
            titleText = <FormattedMessage defaultMessage='Track key metrics and measure value'/>;
            helpText = <FormattedMessage defaultMessage='Use metrics to understand patterns and progress across runs, and track performance.'/>;
            break;
        case AdminNotificationType.CHECKLIST_ITEM_DUE_DATE:
            titleText = <FormattedMessage defaultMessage='Work more effectively'/>;
            helpText = <FormattedMessage defaultMessage='Assign due dates to tasks so assignees can prioritize and get things done.'/>;
            break;
        case AdminNotificationType.REQUEST_UPDATE:
            titleText = <FormattedMessage defaultMessage='Try request update with a free trial'/>;
            helpText = <FormattedMessage defaultMessage='Request updates for playbook runs in a single click and get notified directly when an update is posted. Start a free, 30-day trial to try it out.'/>;
            break;
        }

        if (!isAdmin) {
            helpText = (
                <>
                    {helpText}
                    <FormattedMessage defaultMessage='Notify your System Admin to upgrade.'/>
                </>
            );
        } else if (isServerTeamEdition) {
            helpText = (
                <>
                    <p>{helpText}</p>
                    <ConvertEnterpriseNotice/>
                </>
            );
        }

        return {
            titleText,
            helpText,
        };
    default:
        if (isAdmin) {
            titleText = <FormattedMessage defaultMessage='Your license could not be generated'/>;
            helpText = <FormattedMessage defaultMessage='Please check the system logs for more information.'/>;
        } else {
            titleText = <FormattedMessage defaultMessage='There was an error'/>;
            helpText = <FormattedMessage defaultMessage="We weren't able to notify the System Admin."/>;
        }

        return {
            titleText,
            helpText,
        };
    }
};
