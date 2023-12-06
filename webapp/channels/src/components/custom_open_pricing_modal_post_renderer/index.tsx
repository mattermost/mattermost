// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import LearnMoreTrialModal from 'components/learn_more_trial_modal/learn_more_trial_modal';
import Markdown from 'components/markdown';

import {ModalIdentifiers, MattermostFeatures} from 'utils/constants';
import {mapFeatureIdToTranslation} from 'utils/notify_admin_utils';

const MinimumPlansForFeature = {
    Professional: 'Professional plan',
    Enterprise: 'Enterprise plan',
};

type FeatureRequest = {
    user_id: string;
    required_feature: string;
    required_plan: string;
    create_at: string;
    trial: string;
}

type RequestedFeature = Record<string, FeatureRequest[]>

type CustomPostProps = {
    requested_features: RequestedFeature;
    trial: boolean;
}

const style = {
    display: 'flex',
    gap: '10px',
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
    width: 'max-content',
    margin: '10px 0',
};

const btnStyle = {
    background: 'var(--button-bg)',
    color: 'var(--button-color)',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 20px',
    fontWeight: 600,
};

const messageStyle = {
    marginBottom: '16px',
};

export default function OpenPricingModalPost(props: {post: Post}) {
    let allProfessional = true;

    const dispatch = useDispatch();
    const userProfiles = useSelector(getUsers);

    const openPurchaseModal = useOpenCloudPurchaseModal({});
    const {formatMessage} = useIntl();

    const openPricingModal = useOpenPricingModal();

    const getUserIdsForUsersThatRequestedFeature = (requests: FeatureRequest[]): string[] => requests.map((request: FeatureRequest) => request.user_id);
    const postProps = props.post.props as Partial<CustomPostProps>;
    const requestFeatures = postProps?.requested_features;
    const wasTrialRequest = postProps?.trial;

    useEffect(() => {
        if (requestFeatures) {
            for (const featureId of Object.keys(requestFeatures)) {
                dispatch(getMissingProfilesByIds(getUserIdsForUsersThatRequestedFeature(requestFeatures[featureId])));
            }
        }
    }, [dispatch, requestFeatures]);

    const isDowngradeNotification = (featureId: string) => featureId === MattermostFeatures.UPGRADE_DOWNGRADED_WORKSPACE;

    const customMessageBody = [];

    const getUserNamesForUsersThatRequestedFeature = (requests: FeatureRequest[]): string[] => {
        const unknownName = formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.unknown', defaultMessage: '@unknown'});
        const userNames = requests.map((req: FeatureRequest) => {
            const username = userProfiles[req.user_id]?.username;
            return username ? '@' + username : unknownName;
        });

        return userNames;
    };

    const renderUsersThatRequestedFeature = (requests: FeatureRequest[]) => {
        if (requests.length >= 5) {
            return formatMessage({
                id: 'postypes.custom_open_pricing_modal_post_renderer.members',
                defaultMessage: '{members} members'},
            {members: requests.length});
        }

        let renderedUsers;

        const users = getUserNamesForUsersThatRequestedFeature(requests);

        if (users.length === 1) {
            renderedUsers = users[0];
        } else {
            const lastUser = users.splice(-1, 1)[0];
            users.push(formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.and', defaultMessage: 'and'}) + ' ' + lastUser);
            renderedUsers = users.join(', ').replace(/,([^,]*)$/, '$1');
        }

        return renderedUsers;
    };

    const markDownOptions = {
        atSumOfMembersMentions: true,
        atPlanMentions: true,
        markdown: false,
    };

    const mapFeatureToPlan = (feature: string) => {
        switch (feature) {
        case MattermostFeatures.ALL_ENTERPRISE_FEATURES:
        case MattermostFeatures.CUSTOM_USER_GROUPS:
            allProfessional = false;
            return MinimumPlansForFeature.Enterprise;
        default:
            return MinimumPlansForFeature.Professional;
        }
    };

    if (requestFeatures) {
        for (const featureId of Object.keys(requestFeatures)) {
            let title = (
                <div id={`${featureId}-title`.replaceAll('.', '_')}>
                    <span>
                        <b>
                            {mapFeatureIdToTranslation(featureId, formatMessage)}
                        </b>
                    </span>
                    <span>
                        <Markdown
                            message={formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.availableOn', defaultMessage: ' - available on the {feature}'}, {feature: mapFeatureToPlan(featureId)})}
                            options={{...markDownOptions, atSumOfMembersMentions: false}}
                        />
                    </span>
                </div>);
            let subTitle = (
                <ul id={`${featureId}-subtitle`.replaceAll('.', '_')}>
                    <li>
                        <Markdown
                            postId={props.post.id}
                            message={formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.userRequests', defaultMessage: '{userRequests} requested access to this feature'}, {userRequests: renderUsersThatRequestedFeature(requestFeatures[featureId])})}
                            options={markDownOptions}
                            userIds={getUserIdsForUsersThatRequestedFeature(requestFeatures[featureId])}
                            messageMetadata={{requestedFeature: featureId}}
                        />
                    </li>
                </ul>);

            if (isDowngradeNotification(featureId)) {
                title = (
                    <div id={`${featureId}-title`.replaceAll('.', '_')}>
                        <span>
                            <b>
                                {mapFeatureIdToTranslation(featureId, formatMessage)}
                            </b>
                        </span>
                    </div>);
                subTitle = (
                    <ul id={`${featureId}-subtitle`.replaceAll('.', '_')}>
                        <li>
                            <Markdown
                                postId={props.post.id}
                                message={formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.downgradeNotfication', defaultMessage: '{userRequests} requested to revert the workspace to a paid plan'}, {userRequests: renderUsersThatRequestedFeature(requestFeatures[featureId])})}
                                options={markDownOptions}
                                userIds={getUserIdsForUsersThatRequestedFeature(requestFeatures[featureId])}
                                messageMetadata={{requestedFeature: featureId}}
                            />
                        </li>
                    </ul>);
            }

            const featureMessage = (
                <div style={messageStyle}>
                    {title}
                    {subTitle}
                </div>
            );

            customMessageBody.push(featureMessage);
        }
    }

    const openLearnMoreTrialModal = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.LEARN_MORE_TRIAL_MODAL,
            dialogType: LearnMoreTrialModal,
            dialogProps: {
                launchedBy: 'pricing_modal',
            },
        }));
    };

    const renderButtons = () => {
        if (wasTrialRequest) {
            return (
                <>
                    <button
                        id='learn_more_about_trial'
                        onClick={() => {
                            trackEvent('cloud_admin', 'click_learn_more_trial_modal', {
                                callerInfo: 'notify_admin_learn_more_about_trial',
                            });
                            openLearnMoreTrialModal();
                        }}
                        style={btnStyle}
                    >
                        {formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.learn_trial', defaultMessage: 'Learn more about trial'})}
                    </button>
                    <button
                        onClick={() => openPricingModal({trackingLocation: 'notify_admin_message_view_upgrade_options'})}
                        style={{...btnStyle, color: 'var(--button-bg)', background: 'rgba(var(--denim-button-bg-rgb), 0.08)'}}
                    >
                        {formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.view_options', defaultMessage: 'View upgrade options'})}
                    </button>
                </>
            );
        }

        if (allProfessional) {
            return (
                <>
                    <button
                        id='upgrade_to_professional'
                        onClick={() => openPurchaseModal({trackingLocation: 'notify_admin_message_view'})}
                        style={btnStyle}
                    >
                        {formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.upgrade_professional', defaultMessage: 'Upgrade to Professional'})}
                    </button>
                    <button
                        id='view_upgrade_options'
                        onClick={() => openPricingModal({trackingLocation: 'notify_admin_message_view_upgrade_options'})}
                        style={{...btnStyle, color: 'var(--button-bg)', background: 'rgba(var(--denim-button-bg-rgb), 0.08)'}}
                    >
                        {formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.view_options', defaultMessage: 'View upgrade options'})}
                    </button>
                </>
            );
        }
        return (
            <button
                id='view_upgrade_options'
                onClick={() => openPricingModal({trackingLocation: 'notify_admin_message_view_upgrade_options'})}
                style={{...btnStyle, border: '1px solid var(--button-bg)', color: 'var(--button-bg)', background: 'var(--sidebar-text)'}}
            >
                {formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.view_options', defaultMessage: 'View upgrade options'})}
            </button>
        );
    };

    return (
        <div>
            <div style={messageStyle}>
                <Markdown
                    message={props.post.message}
                    options={{...markDownOptions, atSumOfMembersMentions: false}}
                />
            </div>
            {customMessageBody}
            <div style={{display: 'flex'}}>
                <div
                    style={style}
                >
                    {renderButtons()}
                </div>
            </div>
        </div>
    );
}
