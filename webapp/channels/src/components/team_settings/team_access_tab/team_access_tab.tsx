// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';

import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import AllowedDomainsSelect from './allowed_domains_select';
import InviteSectionInput from './invite_section_input';
import OpenInvite from './open_invite';

import type {PropsFromRedux, OwnProps} from '.';

import './team_access_tab.scss';

const generateAllowedDomainOptions = (allowedDomains?: string) => {
    if (!allowedDomains || allowedDomains.length === 0) {
        return [];
    }
    const domainList = allowedDomains.includes(',') ? allowedDomains.split(',') : [allowedDomains];
    return domainList.map((domain) => domain.trim());
};

type Props = PropsFromRedux & OwnProps;

const AccessTab = ({showTabSwitchError, areThereUnsavedChanges, setShowTabSwitchError, setAreThereUnsavedChanges, team, actions}: Props) => {
    const [allowedDomains, setAllowedDomains] = useState<string[]>(() => generateAllowedDomainOptions(team.allowed_domains));
    const [allowOpenInvite, setAllowOpenInvite] = useState<boolean>(team.allow_open_invite ?? false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

    const handleAllowedDomainsSubmit = useCallback(async (): Promise<boolean> => {
        const {error} = await actions.patchTeam({
            id: team.id,
            allowed_domains: allowedDomains.length === 1 ? allowedDomains[0] : allowedDomains.join(', '),
        });
        if (error) {
            return false;
        }
        return true;
    }, [actions, allowedDomains, team]);

    const handleOpenInviteSubmit = useCallback(async (): Promise<boolean> => {
        if (allowOpenInvite === team.allow_open_invite) {
            return true;
        }
        const data = {
            id: team.id,
            allow_open_invite: allowOpenInvite,
        };

        const {error} = await actions.patchTeam(data);
        if (error) {
            return false;
        }
        return true;
    }, [actions, allowOpenInvite, team]);

    const updateOpenInvite = useCallback((value: boolean) => {
        setAreThereUnsavedChanges(true);
        setSaveChangesPanelState('editing');
        setAllowOpenInvite(value);
    }, [setAreThereUnsavedChanges]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState('editing');
        setAreThereUnsavedChanges(false);
        setShowTabSwitchError(false);
    }, [setShowTabSwitchError, setAreThereUnsavedChanges]);

    const handleCancel = useCallback(() => {
        setAllowedDomains(generateAllowedDomainOptions(team.allowed_domains));
        setAllowOpenInvite(team.allow_open_invite ?? false);
        handleClose();
    }, [handleClose, team.allow_open_invite, team.allowed_domains]);

    const handleSaveChanges = useCallback(async () => {
        const allowedDomainSuccess = await handleAllowedDomainsSubmit();
        const openInviteSuccess = await handleOpenInviteSubmit();
        if (!allowedDomainSuccess || !openInviteSuccess) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
        setShowTabSwitchError(false);

        // allows modal to close immediately
        setAreThereUnsavedChanges(false);
    }, [handleAllowedDomainsSubmit, handleOpenInviteSubmit, setShowTabSwitchError, setAreThereUnsavedChanges]);

    return (
        <div
            className='modal-access-tab-content user-settings'
            id='accessSettings'
            aria-labelledby='accessButton'
            role='tabpanel'
        >
            {!team.group_constrained && (
                <AllowedDomainsSelect
                    allowedDomains={allowedDomains}
                    setAllowedDomains={setAllowedDomains}
                    setHasChanges={setAreThereUnsavedChanges}
                    setSaveChangesPanelState={setSaveChangesPanelState}
                />
            )}
            <div className='divider-light'/>
            <OpenInvite
                isGroupConstrained={team.group_constrained}
                allowOpenInvite={allowOpenInvite}
                setAllowOpenInvite={updateOpenInvite}
            />
            <div className='divider-light'/>
            {!team.group_constrained && (
                <InviteSectionInput regenerateTeamInviteId={actions.regenerateTeamInviteId}/>
            )}
            {(areThereUnsavedChanges || saveChangesPanelState === 'saved') && (
                <SaveChangesPanel
                    handleCancel={handleCancel}
                    handleSubmit={handleSaveChanges}
                    handleClose={handleClose}
                    tabChangeError={showTabSwitchError}
                    state={saveChangesPanelState}
                />
            )}
        </div>
    );
};

export default AccessTab;
