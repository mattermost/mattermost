// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import type {GlobalState} from '@mattermost/types/store';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {Permissions} from 'mattermost-redux/constants';
import {getLicense, getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import {makeAsyncComponent} from 'components/async_load';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

import './menu_item.scss';

const LearnMoreTrialModal = makeAsyncComponent('LearnMoreTrialModal', React.lazy(() => import('components/learn_more_trial_modal/learn_more_trial_modal')));

const FreeVersionBadge = styled.div`
     position: relative;
     top: 1px;
     display: flex;
     padding: 2px 6px;
     border-radius: var(--radius-s);
     margin-bottom: 6px;
     background: rgba(var(--center-channel-color-rgb), 0.08);
     color: rgba(var(--center-channel-color-rgb), 0.75);
     font-family: 'Open Sans', sans-serif;
     font-size: 10px;
     font-weight: 600;
     letter-spacing: 0.025em;
     line-height: 16px;
`;

type Props = {
    id: string;
}

const MenuStartTrial = (props: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, []);

    const config = useSelector(getConfig);
    const isE0 = config.BuildEnterpriseReady === 'true';
    const hasPermissionForStartTrial = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE}));

    const openLearnMoreTrialModal = () => {
        trackEvent(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            'open_learn_more_trial_modal',
        );
        dispatch(openModal({
            modalId: ModalIdentifiers.LEARN_MORE_TRIAL_MODAL,
            dialogType: LearnMoreTrialModal,
        }));
    };
    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const license = useSelector(getLicense);
    const isPrevLicensed = prevTrialLicense?.IsLicensed;
    const isCurrentLicensed = license?.IsLicensed;

    if (isCurrentLicensed === 'true') {
        return null;
    }

    const showTrialButton = isCurrentLicensed === 'false' && isPrevLicensed === 'false' && hasPermissionForStartTrial && isE0;

    return (
        <li
            className={'MenuStartTrial'}
            role='menuitem'
            id={props.id}
        >
            <FreeVersionBadge>{'FREE EDITION'}</FreeVersionBadge>
            {isE0 &&
                <div className='start_trial_content'>
                    {formatMessage({
                        id: 'navbar_dropdown.versionTextE0',
                        defaultMessage: 'This is the free edition of Mattermost, ideal for evaluation and small teams.',
                    })}
                </div>}
            {!isE0 &&
                <div className='start_trial_content'>
                    {formatMessage({
                        id: 'navbar_dropdown.versionTextTeamEdition',
                        defaultMessage: 'This is the free open source edition of Mattermost, ideal for evaluation and small teams.',
                    })}
                </div>}
            {showTrialButton &&
                <button onClick={openLearnMoreTrialModal}>
                    {formatMessage({id: 'navbar_dropdown.startAnEnterpriseTrial', defaultMessage: 'Start an Enterprise trial'})}
                </button>}
        </li>
    );
};

export default MenuStartTrial;
