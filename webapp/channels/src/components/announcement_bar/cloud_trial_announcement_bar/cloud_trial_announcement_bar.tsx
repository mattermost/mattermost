// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEmpty from 'lodash/isEmpty';
import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {AlertCircleOutlineIcon, AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {Subscription} from '@mattermost/types/cloud';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {trackEvent} from 'actions/telemetry_actions';

import PricingModal from 'components/pricing_modal';

import {
    Preferences,
    CloudBanners,
    AnnouncementBarTypes,
    ModalIdentifiers,
    TELEMETRY_CATEGORIES,
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
    reverseTrial: boolean;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
        getCloudSubscription: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

const MAX_DAYS_BANNER = 'max_days_banner';
const THREE_DAYS_BANNER = '3_days_banner';
class CloudTrialAnnouncementBar extends React.PureComponent<Props> {
    async componentDidMount() {
        if (!isEmpty(this.props.subscription) && this.shouldShowBanner()) {
            const {daysLeftOnTrial} = this.props;
            if (this.isDismissable()) {
                trackEvent(
                    TELEMETRY_CATEGORIES.CLOUD_ADMIN,
                    `bannerview_trial_${daysLeftOnTrial}_days`,
                );
            } else {
                trackEvent(
                    TELEMETRY_CATEGORIES.CLOUD_ADMIN,
                    'bannerview_trial_limit_ended',
                );
            }
        }
    }

    handleClose = async () => {
        const {daysLeftOnTrial} = this.props;
        let dismissValue = '';
        if (daysLeftOnTrial > TrialPeriodDays.TRIAL_WARNING_THRESHOLD) {
            dismissValue = MAX_DAYS_BANNER;
        } else if (daysLeftOnTrial <= TrialPeriodDays.TRIAL_WARNING_THRESHOLD && daysLeftOnTrial >= TrialPeriodDays.TRIAL_1_DAY) {
            dismissValue = THREE_DAYS_BANNER;
        }
        trackEvent(
            TELEMETRY_CATEGORIES.CLOUD_ADMIN,
            `dismissed_banner_trial_${daysLeftOnTrial}_days`,
        );
        await this.props.actions.savePreferences(this.props.currentUser.id, [{
            category: Preferences.CLOUD_TRIAL_BANNER,
            user_id: this.props.currentUser.id,
            name: CloudBanners.TRIAL,
            value: `${dismissValue}`,
        }]);
    };

    shouldShowBanner = () => {
        const {isFreeTrial, userIsAdmin, isCloud} = this.props;
        return isFreeTrial && userIsAdmin && isCloud;
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
        const {daysLeftOnTrial} = this.props;
        if (this.isDismissable()) {
            trackEvent(
                TELEMETRY_CATEGORIES.CLOUD_ADMIN,
                `click_subscribe_from_trial_banner_${daysLeftOnTrial}_days`,
            );
        } else {
            trackEvent(
                TELEMETRY_CATEGORIES.CLOUD_ADMIN,
                'click_subscribe_from_banner_trial_ended',
            );
        }
        this.props.actions.openModal({
            modalId: ModalIdentifiers.PRICING_MODAL,
            dialogType: PricingModal,
        });
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

        let trialMoreThan7DaysMsg = (
            <FormattedMessage
                id='admin.billing.subscription.cloudTrial.daysLeft'
                defaultMessage='Your trial has started! There are {daysLeftOnTrial} days left'
                values={{daysLeftOnTrial}}
            />
        );

        let modalButtonText;
        if (this.props.reverseTrial) {
            modalButtonText = messages.trialButton;
        } else {
            modalButtonText = messages.reverseTrialButton;
        }

        if (this.props.reverseTrial) {
            const trialEnd = getLocaleDateFromUTC((this.props.subscription?.trial_end_at as number / 1000), 'MMMM Do');
            trialMoreThan7DaysMsg = (
                <FormattedMessage
                    id='admin.billing.subscription.cloudTrial.moreThan3Days'
                    defaultMessage='Your 30 day Enterprise trial has started! Purchase before {trialEnd} to keep your workspace.'
                    values={{trialEnd}}
                />
            );
        }

        let trialLessThan7DaysMsg = (
            <FormattedMessage
                id='admin.billing.subscription.cloudTrial.daysLeftOnTrial'
                defaultMessage='There are {daysLeftOnTrial} days left on your free trial'
                values={{daysLeftOnTrial}}
            />
        );

        if (this.props.reverseTrial) {
            trialLessThan7DaysMsg = (
                <FormattedMessage
                    id='admin.billing.subscription.cloudReverseTrial.daysLeftOnTrial'
                    defaultMessage='{daysLeftOnTrial} days left on your trial. Purchase a plan or contact sales to keep your workspace.'
                    values={{daysLeftOnTrial}}
                />
            );
        }

        const userEndTrialDate = getLocaleDateFromUTC((this.props.subscription?.trial_end_at as number / 1000), 'MMMM Do YYYY');
        const userEndTrialHour = getLocaleDateFromUTC((this.props.subscription?.trial_end_at as number / 1000), 'HH:mm', this.props.currentUser.timezone?.automaticTimezone as string);

        let trialLastDaysMsg = (
            <FormattedMessage
                id='admin.billing.subscription.cloudTrial.lastDay'
                defaultMessage='This is the last day of your free trial. Your access will expire on {userEndTrialDate} at {userEndTrialHour}.'
                values={{userEndTrialHour, userEndTrialDate}}
            />
        );

        if (this.props.reverseTrial) {
            trialLastDaysMsg = (
                <FormattedMessage
                    id='admin.billing.subscription.cloudReverseTrial.lastDay'
                    defaultMessage='This is the last day of your trial. Purchase a plan before {userEndTrialHour} or contact sales'
                    values={{userEndTrialHour}}
                />
            );
        }

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

export default CloudTrialAnnouncementBar;
