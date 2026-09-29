// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';

import {openModal} from 'actions/views/modals';

import CreateTeamModal from 'components/admin_console/create_team_modal';
import TeamList from 'components/admin_console/team_channel_settings/team/list';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    siteName: string;
};

const panelTitle = defineMessage({id: 'admin.team_settings.title', defaultMessage: 'Teams'});
const panelSubtitle = defineMessage({id: 'admin.team_settings.description', defaultMessage: 'Manage team settings.'});
const createTeamButtonText = defineMessage({id: 'admin.team_settings.createTeam', defaultMessage: 'Create Team'});

export function TeamsSettings(props: Props) {
    const dispatch = useDispatch();
    const canCreateTeam = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.SYSCONSOLE_WRITE_USERMANAGEMENT_TEAMS}));

    const handleCreateTeam = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_TEAM_MODAL,
            dialogType: CreateTeamModal,
        }));
    }, [dispatch]);

    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.team_settings.groupsPageTitle'
                    defaultMessage='{siteName} Teams'
                    values={{siteName: props.siteName}}
                />
            </AdminHeader>

            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {canCreateTeam ? (
                        <AdminPanelWithButton
                            id='teams'
                            title={panelTitle}
                            subtitle={panelSubtitle}
                            buttonText={createTeamButtonText}
                            onButtonClick={handleCreateTeam}
                        >
                            <TeamList/>
                        </AdminPanelWithButton>
                    ) : (
                        <AdminPanel
                            id='teams'
                            title={panelTitle}
                            subtitle={panelSubtitle}
                        >
                            <TeamList/>
                        </AdminPanel>
                    )}
                </div>
            </div>
        </div>
    );
}
