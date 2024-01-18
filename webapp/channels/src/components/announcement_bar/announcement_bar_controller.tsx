// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ClientLicense, ClientConfig, WarnMetricStatus} from '@mattermost/types/config';

import {ToPaidPlanBannerDismissable} from 'components/admin_console/billing/billing_subscriptions/to_paid_plan_nudge_banner';
import withGetCloudSubscription from 'components/common/hocs/cloud/with_get_cloud_subscription';

import CloudAnnualRenewalAnnouncementBar from './cloud_annual_renewal';
import CloudDelinquencyAnnouncementBar from './cloud_delinquency';
import CloudTrialAnnouncementBar from './cloud_trial_announcement_bar';
import CloudTrialEndAnnouncementBar from './cloud_trial_ended_announcement_bar';
import ConfigurationAnnouncementBar from './configuration_bar';
import AnnouncementBar from './default_announcement_bar';
import OverageUsersBanner from './overage_users_banner';
import PaymentAnnouncementBar from './payment_announcement_bar';
import AutoStartTrialModal from './show_start_trial_modal/show_start_trial_modal';
import ShowThreeDaysLeftTrialModal from './show_tree_days_left_trial_modal/show_three_days_left_trial_modal';
import TextDismissableBar from './text_dismissable_bar';
import UsersLimitsAnnouncementBar from './users_limits_announcement_bar';
import VersionBar from './version_bar';

type Props = {
    license?: ClientLicense;
    config?: Partial<ClientConfig>;
    canViewSystemErrors: boolean;
    userIsAdmin: boolean;
    latestError?: {
        error: any;
    };
    warnMetricsStatus?: Record<string, WarnMetricStatus>;
    actions: {
        dismissError: (index: number) => void;
        getCloudSubscription: () => void;
        getCloudCustomer: () => void;
    };
};

class AnnouncementBarController extends React.PureComponent<Props> {
    render() {
        let adminConfiguredAnnouncementBar = null;
        if (this.props.config?.EnableBanner === 'true' && this.props.config.BannerText?.trim()) {
            adminConfiguredAnnouncementBar = (
                <TextDismissableBar
                    color={this.props.config.BannerColor}
                    textColor={this.props.config.BannerTextColor}
                    allowDismissal={this.props.config.AllowBannerDismissal === 'true'}
                    text={this.props.config.BannerText}
                />
            );
        }

        let errorBar = null;
        if (this.props.latestError) {
            errorBar = (
                <AnnouncementBar
                    type={this.props.latestError.error.type}
                    message={this.props.latestError.error.message}
                    showCloseButton={true}
                    handleClose={this.props.actions.dismissError}
                />
            );
        }

        let paymentAnnouncementBar = null;
        let cloudTrialAnnouncementBar = null;
        let cloudTrialEndAnnouncementBar = null;
        let cloudDelinquencyAnnouncementBar = null;
        let cloudRenewalAnnouncementBar = null;
        const notifyAdminDowngradeDelinquencyBar = null;
        const toYearlyNudgeBannerDismissable = null;
        let toPaidPlanNudgeBannerDismissable = null;
        if (this.props.license?.Cloud === 'true') {
            paymentAnnouncementBar = (
                <PaymentAnnouncementBar/>
            );
            cloudTrialAnnouncementBar = (
                <CloudTrialAnnouncementBar/>
            );
            cloudTrialEndAnnouncementBar = (
                <CloudTrialEndAnnouncementBar/>
            );
            cloudDelinquencyAnnouncementBar = (
                <CloudDelinquencyAnnouncementBar/>
            );
            cloudRenewalAnnouncementBar = (
                <CloudAnnualRenewalAnnouncementBar/>
            );
            toPaidPlanNudgeBannerDismissable = (<ToPaidPlanBannerDismissable/>);
        }

        let autoStartTrialModal = null;
        if (this.props.userIsAdmin) {
            autoStartTrialModal = (
                <AutoStartTrialModal/>
            );
        }

        return (
            <>
                {adminConfiguredAnnouncementBar}
                {errorBar}
                <UsersLimitsAnnouncementBar
                    license={this.props.license}
                    userIsAdmin={this.props.userIsAdmin}
                />
                {paymentAnnouncementBar}
                {cloudTrialAnnouncementBar}
                {cloudTrialEndAnnouncementBar}
                {cloudDelinquencyAnnouncementBar}
                {cloudRenewalAnnouncementBar}
                {notifyAdminDowngradeDelinquencyBar}
                {toYearlyNudgeBannerDismissable}
                {toPaidPlanNudgeBannerDismissable}
                {this.props.license?.Cloud !== 'true' && <OverageUsersBanner/>}
                {autoStartTrialModal}
                <ShowThreeDaysLeftTrialModal/>
                <VersionBar/>
                <ConfigurationAnnouncementBar
                    config={this.props.config}
                    license={this.props.license}
                    canViewSystemErrors={this.props.canViewSystemErrors}
                    warnMetricsStatus={this.props.warnMetricsStatus}
                />
            </>
        );
    }
}

export default withGetCloudSubscription(AnnouncementBarController);
