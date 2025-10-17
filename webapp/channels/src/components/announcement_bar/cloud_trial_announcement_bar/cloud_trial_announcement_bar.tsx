// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {AlertCircleOutlineIcon, AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {Subscription} from '@mattermost/types/cloud';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import type {UseOpenPricingModalReturn} from 'components/common/hooks/useOpenPricingModal';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {
    Preferences,
    CloudBanners,
    AnnouncementBarTypes,
    TrialPeriodDays,
} from 'utils/constants';
import {getLocaleDateFromUTC} from 'utils/utils';

import type {ModalData} from 'types/actions';

import AnnouncementBar from '../default_announcement_bar';

type Props = {
    userIsAdmin: boolean;
    isFreeTrial: boolean;
    currentUser: UserProfile;
    preferences: PreferenceType[];
    daysLeftOnTrial: number;
    isCloud: boolean;
    subscription?: Subscription;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
        getCloudSubscription: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

type PropsWithPricingModal = Props & UseOpenPricingModalReturn;

const MAX_DAYS_BANNER = 'max_days_banner';
const THREE_DAYS_BANNER = '3_days_banner';
class CloudTrialAnnouncementBarInternal extends React.PureComponent<PropsWithPricingModal> {
    handleClose = async () => {
        const {daysLeftOnTrial} = this.props;
        let dismissValue = '';
        if (daysLeftOnTrial > TrialPeriodDays.TRIAL_WARNING_THRESHOLD) {
            dismissValue = MAX_DAYS_BANNER;
        } else if (daysLeftOnTrial <= TrialPeriodDays.TRIAL_WARNING_THRESHOLD && daysLeftOnTrial >= TrialPeriodDays.TRIAL_1_DAY) {
            dismissValue = THREE_DAYS_BANNER;
        }
        await this.props.actions.savePreferences(this.props.currentUser.id, [{
            category: Preferences.CLOUD_TRIAL_BANNER,
            user_id: this.props.currentUser.id,
            name: CloudBanners.TRIAL,
            value: `${dismissValue}`,
        }]);
    };

    shouldShowBanner = () => {
        const {isFreeTrial, userIsAdmin, isCloud, isAirGapped, subscription} = this.props;
        return isFreeTrial && userIsAdmin && isCloud && !isAirGapped && !subscription?.is_cloud_preview;
    };

    isDismissable = () => {
        const {daysLeftOnTrial} = this.props;
        let dismissable = true;

        if (daysLeftOnTrial <= TrialPeriodDays.TRIAL_1_DAY) {
            dismissable = false;
        }
        return dismissable;
    };

    showModal = () => {
        this.props.openPricingModal();
    };

    render() {
        const {daysLeftOnTrial, preferences} = this.props;

        if (!this.shouldShowBanner()) {
            return null;
        }

        if ((preferences.some((pref) => pref.name === CloudBanners.TRIAL && pref.value === MAX_DAYS_BANNER) && daysLeftOnTrial > TrialPeriodDays.TRIAL_WARNING_THRESHOLD) ||
            ((daysLeftOnTrial <= TrialPeriodDays.TRIAL_WARNING_THRESHOLD && daysLeftOnTrial >= TrialPeriodDays.TRIAL_1_DAY) &&
            preferences.some((pref) => pref.name === CloudBanners.TRIAL && pref.value === THREE_DAYS_BANNER))) {
            return null;
        }

        const trialMoreThan7DaysMsg = (
            <FormattedMessage
                id='admin.billing.subscription.cloudTrial.daysLeft'
                defaultMessage='Your trial has started! There are {daysLeftOnTrial} days left'
                values={{daysLeftOnTrial}}
            />
        );

        const modalButtonText = messages.trialButton;

        const trialLessThan7DaysMsg = (
            <FormattedMessage
                id='admin.billing.subscription.cloudReverseTrial.daysLeftOnTrial'
                defaultMessage='{daysLeftOnTrial} days left on your trial. Purchase a plan or contact sales to keep your workspace.'
                values={{daysLeftOnTrial}}
            />
        );

        const userEndTrialHour = getLocaleDateFromUTC((this.props.subscription?.trial_end_at as number / 1000), 'HH:mm', this.props.currentUser.timezone?.automaticTimezone as string);

        const trialLastDaysMsg = (
            <FormattedMessage
                id='admin.billing.subscription.cloudReverseTrial.lastDay'
                defaultMessage='This is the last day of your trial. Purchase a plan before {userEndTrialHour} or contact sales'
                values={{userEndTrialHour}}
            />
        );

        let bannerMessage;
        let icon;

        if (daysLeftOnTrial >= TrialPeriodDays.TRIAL_2_DAYS && daysLeftOnTrial <= TrialPeriodDays.TRIAL_WARNING_THRESHOLD) {
            bannerMessage = trialLessThan7DaysMsg;
            icon = <AlertCircleOutlineIcon size={18}/>;
        } else if (daysLeftOnTrial <= TrialPeriodDays.TRIAL_1_DAY && daysLeftOnTrial >= TrialPeriodDays.TRIAL_0_DAYS) {
            bannerMessage = trialLastDaysMsg;
            icon = <AlertOutlineIcon size={18}/>;
        } else {
            bannerMessage = trialMoreThan7DaysMsg;
            icon = <AlertCircleOutlineIcon size={18}/>;
        }

        const dismissable = this.isDismissable();

        return (
            <AnnouncementBar
                type={dismissable ? AnnouncementBarTypes.ADVISOR : AnnouncementBarTypes.CRITICAL}
                showCloseButton={dismissable}
                handleClose={this.handleClose}
                onButtonClick={this.showModal}
                modalButtonText={modalButtonText}
                message={bannerMessage}
                showLinkAsButton={true}
                icon={icon}
            />
        );
    }
}

const messages = defineMessages({
    reverseTrialButton: {
        id: 'admin.billing.subscription.cloudReverseTrial.subscribeButton',
        defaultMessage: 'Review your options',
    },
    trialButton: {
        id: 'admin.billing.subscription.cloudTrial.subscribeButton',
        defaultMessage: 'Upgrade Now',
    },
});

// Wrapper component to use the hook
const CloudTrialAnnouncementBar: React.FC<Props> = (props) => {
    const {openPricingModal, isAirGapped} = useOpenPricingModal();

    return (
        <CloudTrialAnnouncementBarInternal
            {...props}
            openPricingModal={openPricingModal}
            isAirGapped={isAirGapped}
        />
    );
};

export default CloudTrialAnnouncementBar;
