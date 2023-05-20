// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';
import {GlobalState} from 'types/store';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';
import {isEnterpriseOrE20License} from 'utils/license_utils';

export const areWorkTemplatesEnabled = createSelector(
    'areWorktemplatesEnabled',
    (state: GlobalState) => getFeatureFlagValue(state, 'WorkTemplate') === 'true',
    (state: GlobalState) => getLicense(state),
    (state: GlobalState) => haveICurrentTeamPermission(state, Permissions.CREATE_PUBLIC_CHANNEL) || haveICurrentTeamPermission(state, Permissions.CREATE_PRIVATE_CHANNEL),
    (state: GlobalState) => haveICurrentTeamPermission(state, Permissions.PLAYBOOK_PUBLIC_CREATE),
    (state: GlobalState) => haveICurrentTeamPermission(state, Permissions.PLAYBOOK_PRIVATE_CREATE),
    (workTemplateFF, license, canCreateChannel, canCreatePublicPlaybook, canCreatePrivatePlaybook) => {
        const licenseIsEnterprise = isEnterpriseOrE20License(license);
        const canCreatePlaybook = canCreatePublicPlaybook || (canCreatePrivatePlaybook && licenseIsEnterprise);
        return workTemplateFF && canCreateChannel && canCreatePlaybook;
    },
);

export const getWorkTemplateCategories = (state: GlobalState) => state.entities.worktemplates.categories;
