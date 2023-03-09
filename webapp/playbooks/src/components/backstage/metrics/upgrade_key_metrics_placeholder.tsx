// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useIntl} from 'react-intl';

import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';
import UpgradeKeyMetricsBackgroundSvg from 'src/components/assets/upgrade_key_metrics_background_svg';

const UpgradeKeyMetricsPlaceholder = () => {
    const {formatMessage} = useIntl();
    return (
        <UpgradeBanner
            background={<UpgradeKeyMetricsBackgroundSvg/>}
            titleText={formatMessage({defaultMessage: 'Track key metrics and measure value'})}
            helpText={formatMessage({defaultMessage: 'Use metrics to understand patterns and progress across runs, and track performance.'})}
            notificationType={AdminNotificationType.PLAYBOOK_METRICS}
            verticalAdjustment={412}
            svgVerticalAdjustment={90}
            vertical={true}
        />
    );
};

export default UpgradeKeyMetricsPlaceholder;
