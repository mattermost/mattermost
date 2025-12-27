// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {AccountMultipleOutlineIcon} from '@mattermost/compass-icons/components';

import {getCloudSubscription, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import UserGroupsModal from 'components/user_groups_modal';
import RestrictedIndicator from 'components/widgets/menu/menu_items/restricted_indicator';

import {FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS} from 'utils/cloud_utils';
import {CloudProducts, LicenseSkus, MattermostFeatures, ModalIdentifiers} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

type Props = {
    isEnterpriseReady: boolean;
}

export default function ProductSwitcherUserGroupsMenuItem(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const isAdmin = useSelector(isCurrentUserSystemAdmin);

    const license = useSelector(getLicense);

    const isCloud = isCloudLicense(license);
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const isCloudStarterFree = isCloud && subscriptionProduct?.sku === CloudProducts.STARTER;
    const subscription = useSelector(getCloudSubscription);
    const isCloudFreeTrial = isCloud && subscription?.is_free_trial === 'true';

    const isSelfHostedStarter = props.isEnterpriseReady && (license.IsLicensed === 'false');
    const isSelfHostedFreeTrial = license.IsTrial === 'true';

    const isStarterFree = isCloudStarterFree || isSelfHostedStarter;
    const isFreeTrial = isCloudFreeTrial || isSelfHostedFreeTrial;

    const isCustomUserGroupsEnabled = useSelector(isCustomGroupsEnabled);

    const isMenuItemVisible = isCustomUserGroupsEnabled || isStarterFree || isFreeTrial;

    const openGroupsModal = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.USER_GROUPS,
            dialogType: UserGroupsModal,
            dialogProps: {
                backButtonAction: openGroupsModal,
            },
        }));
    }, [dispatch]);

    function handleClick() {
        openGroupsModal();
    }

    if (!isMenuItemVisible) {
        return null;
    }

    const showRestrictedIndicator = isAdmin && (isStarterFree || isFreeTrial);

    return (
        <Menu.Item
            disabled={isStarterFree}
            leadingElement={<AccountMultipleOutlineIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='globalHeader.productSwitcherMenu.userGroupsMenuItem.label'
                    defaultMessage='User Groups'
                />
            }
            trailingElements={showRestrictedIndicator && (
                <RestrictedIndicator
                    blocked={isStarterFree}
                    feature={MattermostFeatures.CUSTOM_USER_GROUPS}
                    minimumPlanRequiredForFeature={LicenseSkus.Professional}
                    tooltipMessage={formatMessage({
                        id: 'navbar_dropdown.userGroups.tooltip.cloudFreeTrial',
                        defaultMessage: 'During your trial you are able to create user groups. These user groups will be archived after your trial.',
                    })}
                    titleAdminPreTrial={formatMessage({
                        id: 'navbar_dropdown.userGroups.modal.titleAdminPreTrial',
                        defaultMessage: 'Try unlimited user groups with a free trial',
                    })}
                    messageAdminPreTrial={formatMessage({
                        id: 'navbar_dropdown.userGroups.modal.messageAdminPreTrial',
                        defaultMessage: 'Create unlimited user groups with one of our paid plans. Get the full experience of Enterprise when you start a free, {trialLength} day trial.',
                    }, {
                        trialLength: FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS,
                    })}
                    titleAdminPostTrial={formatMessage({
                        id: 'navbar_dropdown.userGroups.modal.titleAdminPostTrial',
                        defaultMessage: 'Upgrade to create unlimited user groups',
                    })}
                    messageAdminPostTrial={formatMessage({
                        id: 'navbar_dropdown.userGroups.modal.messageAdminPostTrial',
                        defaultMessage: 'User groups are a way to organize users and apply actions to all users within that group. Upgrade to the Professional plan to create unlimited user groups.',
                    })}
                    titleEndUser={formatMessage({
                        id: 'navbar_dropdown.userGroups.modal.titleEndUser',
                        defaultMessage: 'User groups available in paid plans',
                    })}
                    messageEndUser={formatMessage({
                        id: 'navbar_dropdown.userGroups.modal.messageEndUser',
                        defaultMessage: 'User groups are a way to organize users and apply actions to all users within that group.',
                    })}
                />
            )}
            onClick={handleClick}
        />
    );
}

