// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import classNames from 'classnames';

import {Permissions} from 'mattermost-redux/constants';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {isMarketplaceEnabled} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';
import ToggleModalButton from 'components/toggle_modal_button';

import {GlobalState} from 'types/store';
import {ModalIdentifiers, Preferences, Touched} from 'utils/constants';

const AddAppsButton = (): JSX.Element | null => {
    const dispatch = useDispatch<DispatchFunc>();
    const {formatMessage} = useIntl();

    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);
    const marketplaceEnabled = useSelector(isMarketplaceEnabled);
    const touched = useSelector((state: GlobalState) => getBool(state, Preferences.TOUCHED, Touched.ADD_APPS));

    const handleButtonClick = useCallback(() => {
        if (!touched) {
            dispatch(savePreferences(
                currentUserId,
                [{
                    category: Preferences.TOUCHED,
                    user_id: currentUserId,
                    name: Touched.ADD_APPS,
                    value: 'true',
                }],
            ));
        }
    }, [touched, currentUserId]);

    const message = formatMessage({id: 'sidebar_left.addApps', defaultMessage: 'Add Apps'});

    if (!marketplaceEnabled || !currentTeamId) {
        return null;
    }

    return (
        <TeamPermissionGate
            teamId={currentTeamId}
            permissions={[Permissions.SYSCONSOLE_WRITE_PLUGINS]}
        >
            <ToggleModalButton
                ariaLabel={message}
                id='addAppsCta'
                className={classNames(
                    'intro-links color--link cursor--pointer',
                    'SidebarChannelNavigator__addAppsCtaLhsButton',
                    {'SidebarChannelNavigator__addAppsCtaLhsButton--untouched': !touched},
                )}
                modalId={ModalIdentifiers.PLUGIN_MARKETPLACE}
                dialogType={MarketplaceModal}
                dialogProps={{openedFrom: 'apps_category_cta'}}
                onClick={handleButtonClick}
            >
                <li aria-label={message}>
                    <i className='icon-plus-box'/>
                    <span>{message}</span>
                </li>
            </ToggleModalButton>
        </TeamPermissionGate>
    );
};

export default AddAppsButton;
