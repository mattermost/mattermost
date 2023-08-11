// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getSubscriptionProduct, checkHadPriorTrial} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {deprecateCloudFree} from 'mattermost-redux/selectors/entities/preferences';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {closeModal, openModal} from 'actions/views/modals';

import RadioGroup from 'components/common/radio_group';
import InvitationModal from 'components/invitation_modal';
import RestrictedIndicator from 'components/widgets/menu/menu_items/restricted_indicator';

import {FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS} from 'utils/cloud_utils';
import {CloudProducts, LicenseSkus, ModalIdentifiers, MattermostFeatures} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './invite_as.scss';

export const InviteType = {
    MEMBER: 'MEMBER',
    GUEST: 'GUEST',
} as const;

export type InviteType = typeof InviteType[keyof typeof InviteType];

export type Props = {
    setInviteAs: (inviteType: InviteType) => void;
    inviteType: InviteType;
    titleClass?: string;
}

export default function InviteAs(props: Props) {
    const {formatMessage} = useIntl();
    const license = useSelector(getLicense);
    const cloudFreeDeprecated = useSelector(deprecateCloudFree);
    const dispatch = useDispatch<DispatchFunc>();

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, []);

    const subscription = useSelector((state: GlobalState) => state.entities.cloud.subscription);
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);
    const config = useSelector(getConfig);

    const isCloudStarter = subscriptionProduct?.sku === CloudProducts.STARTER;
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    const isSelfHostedStarter = isEnterpriseReady && license.IsLicensed === 'false';
    const isStarter = isCloudStarter || isSelfHostedStarter;

    let extraGuestLegend = true;
    let guestDisabledClass = '';
    let badges = null;
    let guestDisabled = null;

    const isCloudFreeTrial = subscription?.is_free_trial === 'true';
    const isSelfHostedTrial = license.IsTrial === 'true';
    const isFreeTrial = isCloudFreeTrial || isSelfHostedTrial;

    const hasCloudPriorTrial = useSelector(checkHadPriorTrial);
    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const hasSelfHostedPriorTrial = prevTrialLicense.IsLicensed === 'true';
    const hasPriorTrial = hasCloudPriorTrial || hasSelfHostedPriorTrial;

    const isPaidSubscription = !isStarter && !isFreeTrial;

    // show the badge logic (the restricted indicator takes care of the look when it is trial or not)
    if (isSystemAdmin && !isPaidSubscription) {
        const closeInviteModal = () => {
            dispatch(closeModal(ModalIdentifiers.INVITATION));
        };

        let ctaExtraContentMsg = '';
        if (isFreeTrial) {
            ctaExtraContentMsg = formatMessage({id: 'free.professional_feature.professional', defaultMessage: 'Professional feature'});
        } else {
            ctaExtraContentMsg = (hasPriorTrial || cloudFreeDeprecated) ? formatMessage({id: 'free.professional_feature.upgrade', defaultMessage: 'Upgrade'}) : formatMessage({id: 'free.professional_feature.try_free', defaultMessage: 'Professional feature- try it out free'});
        }

        const restrictedIndicator = (
            <RestrictedIndicator
                blocked={!isFreeTrial}
                feature={MattermostFeatures.GUEST_ACCOUNTS}
                minimumPlanRequiredForFeature={LicenseSkus.Professional}
                titleAdminPreTrial={formatMessage({
                    id: 'invite_modal.restricted_invite_guest.pre_trial_title',
                    defaultMessage: 'Try inviting guests with a free trial',
                })}
                messageAdminPreTrial={formatMessage({
                    id: 'invite_modal.restricted_invite_guest.pre_trial_description',
                    defaultMessage: 'Collaborate with users outside of your organization while tightly controlling their access to channels and team members. Get the full experience of Enterprise when you start a free, {trialLength} day trial.',
                },
                {trialLength: FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS},
                )}
                titleAdminPostTrial={formatMessage({
                    id: 'invite_modal.restricted_invite_guest.post_trial_title',
                    defaultMessage: 'Upgrade to invite guest',
                })}
                messageAdminPostTrial={formatMessage({
                    id: 'invite_modal.restricted_invite_guest.post_trial_description',
                    defaultMessage: 'Collaborate with users outside of your organization while tightly controlling their access to channels and team members. Upgrade to the Professional plan to create unlimited user groups.',
                })}
                ctaExtraContent={(
                    <span className='tag-text'>
                        {ctaExtraContentMsg}
                    </span>
                )}
                clickCallback={closeInviteModal}
                tooltipMessage={hasPriorTrial ? formatMessage({id: 'free.professional_feature.upgrade', defaultMessage: 'Upgrade'}) : undefined}

                // the secondary back button first closes the restridted feature modal and then opens back the invitation modal
                customSecondaryButtonInModal={hasPriorTrial ? undefined : {
                    msg: formatMessage({id: 'free.professional_feature.back', defaultMessage: 'Back'}),
                    action: () => {
                        dispatch(closeModal(ModalIdentifiers.FEATURE_RESTRICTED_MODAL));
                        dispatch(openModal({
                            modalId: ModalIdentifiers.INVITATION,
                            dialogType: InvitationModal,
                        }));
                    },
                }}
            />
        );
        guestDisabledClass = isFreeTrial ? '' : 'disabled-legend';
        badges = {
            matchVal: InviteType.GUEST as string,
            badgeContent: restrictedIndicator,
            extraClass: 'Tag__restricted-indicator-badge',
        };
        extraGuestLegend = false;
    }

    // disable the radio button logic (is disabled when is starter - pre and post trial)
    if (isStarter) {
        guestDisabled = (id: string) => {
            return (id === InviteType.GUEST);
        };
    }

    return (
        <div className='InviteAs'>
            <div className={props.titleClass}>
                <FormattedMessage
                    id='invite_modal.as'
                    defaultMessage='Invite as'
                />
            </div>
            <div>
                <RadioGroup
                    onChange={(e) => props.setInviteAs(e.target.value as InviteType)}
                    value={props.inviteType}
                    id='invite-as'
                    values={[
                        {
                            key: (
                                <FormattedMessage
                                    id='invite_modal.choose_member'
                                    defaultMessage='Member'
                                />
                            ),
                            value: InviteType.MEMBER,
                            testId: 'inviteMembersLink',
                        },
                        {
                            key: (
                                <span className={`InviteAs__label ${guestDisabledClass}`}>
                                    <FormattedMessage
                                        id='invite_modal.choose_guest_a'
                                        defaultMessage='Guest'
                                    />
                                    {extraGuestLegend && <span className='InviteAs__label--parenthetical'>
                                        {' - '}
                                        <FormattedMessage
                                            id='invite_modal.choose_guest_b'
                                            defaultMessage='limited to select channels and teams'
                                        />
                                    </span>}
                                </span>
                            ),
                            value: InviteType.GUEST,
                            testId: 'inviteGuestLink',
                        },
                    ]}
                    isDisabled={guestDisabled}
                    badge={badges}
                />
            </div>
        </div>
    );
}
