// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import ModalSection from 'components/widgets/modals/components/modal_section';
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

const AccessTab = ({closeModal, collapseModal, hasChangeTabError, hasChanges, setHasChangeTabError, setHasChanges, team, actions}: Props) => {
    const [allowedDomains, setAllowedDomains] = useState<string[]>(() => generateAllowedDomainOptions(team.allowed_domains));
    const [allowOpenInvite, setAllowOpenInvite] = useState<boolean>(team.allow_open_invite ?? false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const {formatMessage} = useIntl();

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
        setHasChanges(true);
        setSaveChangesPanelState('editing');
        setAllowOpenInvite(value);
    }, [setHasChanges]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState('editing');
        setHasChanges(false);
        setHasChangeTabError(false);
    }, [setHasChangeTabError, setHasChanges]);

    const handleCancel = useCallback(() => {
        setAllowedDomains(generateAllowedDomainOptions(team.allowed_domains));
        setAllowOpenInvite(team.allow_open_invite ?? false);
        handleClose();
    }, [handleClose, team.allow_open_invite, team.allowed_domains]);

    const collapseModalHandler = useCallback(() => {
        if (hasChanges) {
            setHasChangeTabError(true);
            return;
        }
        collapseModal();
    }, [collapseModal, hasChanges, setHasChangeTabError]);

    const handleSaveChanges = useCallback(async () => {
        const allowedDomainSuccess = await handleAllowedDomainsSubmit();
        const openInviteSuccess = await handleOpenInviteSubmit();
        if (!allowedDomainSuccess || !openInviteSuccess) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
        setHasChangeTabError(false);
    }, [handleAllowedDomainsSubmit, handleOpenInviteSubmit, setHasChangeTabError]);

    return (
        <ModalSection
            content={
                <>
                    <div className='modal-header'>
                        <button
                            id='closeButton'
                            type='button'
                            className='close'
                            data-dismiss='modal'
                            onClick={closeModal}
                        >
                            <span aria-hidden='true'>{'×'}</span>
                        </button>
                        <h4 className='modal-title'>
                            <div className='modal-back'>
                                <i
                                    className='fa fa-angle-left'
                                    aria-label={formatMessage({
                                        id: 'generic_icons.collapse',
                                        defaultMessage: 'Collapes Icon',
                                    })}
                                    onClick={collapseModalHandler}
                                />
                            </div>
                            <span>{formatMessage({id: 'team_settings_modal.title', defaultMessage: 'Team Settings'})}</span>
                        </h4>
                    </div>
                    <div
                        className='modal-access-tab-content user-settings'
                        id='accessSettings'
                        aria-labelledby='accessButton'
                        role='tabpanel'
                    >
                        {team.group_constrained ?
                            undefined :
                            <AllowedDomainsSelect
                                allowedDomains={allowedDomains}
                                setAllowedDomains={setAllowedDomains}
                                setHasChanges={setHasChanges}
                                setSaveChangesPanelState={setSaveChangesPanelState}
                            />
                        }
                        <div className='divider-light'/>
                        <OpenInvite
                            isGroupConstrained={team.group_constrained}
                            allowOpenInvite={allowOpenInvite}
                            setAllowOpenInvite={updateOpenInvite}
                        />
                        <div className='divider-light'/>
                        {team.group_constrained ?
                            undefined :
                            <InviteSectionInput regenerateTeamInviteId={actions.regenerateTeamInviteId}/>
                        }
                        {hasChanges ?
                            <SaveChangesPanel
                                handleCancel={handleCancel}
                                handleSubmit={handleSaveChanges}
                                handleClose={handleClose}
                                tabChangeError={hasChangeTabError}
                                state={saveChangesPanelState}
                            /> : undefined}
                    </div>
                </>
            }
        />
    );
};
export default AccessTab;
