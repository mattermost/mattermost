// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {ProductIdentifier} from '@mattermost/types/products';

import {isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';

import {
    OnboardingTourSteps,
    OnboardingTourStepsForGuestUsers,
} from 'components/tours';
import {
    CustomizeYourExperienceTour,
    useShowOnboardingTutorialStep,
} from 'components/tours/onboarding_tour';
import UserAccountMenu from 'components/user_account_menu';

import Pluggable from 'plugins/pluggable';
import {isChannels} from 'utils/products';

import type {GlobalState} from 'types/store';

import AtMentionsButton from './at_mentions_button/at_mentions_button';
import PlanUpgradeButton from './plan_upgrade_button';
import SavedPostsButton from './saved_posts_button/saved_posts_button';
import SettingsButton from './settings_button';

import './right_control.scss';

export type Props = {
    productId?: ProductIdentifier;
};

const RightControls = ({productId = null}: Props): JSX.Element => {
    // guest validation to see which point the messaging tour tip starts
    const isGuestUser = useSelector((state: GlobalState) =>
        isCurrentUserGuestUser(state),
    );
    const tourStep = isGuestUser ? OnboardingTourStepsForGuestUsers.CUSTOMIZE_EXPERIENCE : OnboardingTourSteps.CUSTOMIZE_EXPERIENCE;

    const showCustomizeTip = useShowOnboardingTutorialStep(tourStep);

    return (
        <div className='globalHeader-right-controls-container'>
            <PlanUpgradeButton/>
            {isChannels(productId) ? (
                <>
                    <AtMentionsButton/>
                    <SavedPostsButton/>
                </>
            ) : (
                <Pluggable
                    pluggableName={'Product'}
                    subComponentName={'headerRightComponent'}
                    pluggableId={productId}
                />
            )}
            <div
                id='CustomizeYourExperienceTour'
                className='globalHeader-right-controls-customize-your-experience-tour'
            >
                {isChannels(productId) && (
                    <>
                        <SettingsButton/>
                        {showCustomizeTip && <CustomizeYourExperienceTour/>}
                    </>
                )}
                <UserAccountMenu/>
            </div>
        </div>
    );
};

export default RightControls;
