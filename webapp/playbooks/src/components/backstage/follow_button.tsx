// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import styled from 'styled-components';

import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {followPlaybookRun, telemetryEvent, unfollowPlaybookRun} from 'src/client';
import {PlaybookRunEventTarget} from 'src/types/telemetry';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import Tooltip from 'src/components/widgets/tooltip';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

interface FollowState {
    isFollowing: boolean;
    followers: string[];
    setFollowers: (followers: string[]) => void;
}

interface Props {
    runID: string;
    followState?: FollowState;
    trigger: 'run_details'|'playbooks_lhs'|'channel_rhs'
}

const FollowButton = styled(TertiaryButton)`
    font-family: 'Open Sans';
    font-size: 12px;
    height: 24px;
    padding: 0 10px;
`;

const UnfollowButton = styled(SecondaryButton)`
    font-family: 'Open Sans';
    font-size: 12px;
    height: 24px;
    padding: 0 10px;
`;

export const FollowUnfollowButton = ({runID, followState, trigger}: Props) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const currentUserId = useSelector(getCurrentUserId);
    const refreshLHS = useLHSRefresh();

    if (followState === undefined) {
        return null;
    }
    const {isFollowing, followers, setFollowers} = followState;

    const toggleFollow = () => {
        const action = isFollowing ? unfollowPlaybookRun : followPlaybookRun;
        const eventTarget = isFollowing ? PlaybookRunEventTarget.Unfollow : PlaybookRunEventTarget.Follow;
        action(runID)
            .then(() => {
                const newFollowers = isFollowing ? followers.filter((userId: string) => userId !== currentUserId) : [...followers, currentUserId];
                setFollowers(newFollowers);
                refreshLHS();
                telemetryEvent(eventTarget, {
                    playbookrun_id: runID,
                    from: trigger,
                });
            })
            .catch(() => {
                addToast({
                    content: formatMessage({defaultMessage: 'It was not possible to {isFollowing, select, true {unfollow} other {follow}} the run'}, {isFollowing}),
                    toastStyle: ToastStyle.Failure,
                });
            });
    };

    if (isFollowing) {
        return (
            <UnfollowButton
                className={'unfollowButton'}
                onClick={toggleFollow}
            >
                {formatMessage({defaultMessage: 'Following'})}
            </UnfollowButton>
        );
    }

    return (
        <Tooltip
            id={'follow-tooltip'}
            placement='bottom'
            content={formatMessage({defaultMessage: 'Get run status update notifications'})}
        >
            <FollowButton
                className={'followButton'}
                onClick={toggleFollow}
            >
                {formatMessage({defaultMessage: 'Follow'})}
            </FollowButton>
        </Tooltip>
    );
};

export default FollowUnfollowButton;
