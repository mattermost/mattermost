// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {RefreshIcon} from '@mattermost/compass-icons/components';
import type {Team} from '@mattermost/types/teams';

import Input from 'components/widgets/inputs/input/input';
import BaseSettingItem, {type BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import AllowedDomainsSelect from './allowed_domains_select';
import OpenInvite from './open_invite';

import type {PropsFromRedux, OwnProps} from '.';

import './team_access_tab.scss';

const translations = defineMessages({
    OpenInviteDescriptionError: {
        id: 'team_settings.openInviteDescription.error',
        defaultMessage: 'There was an error generating the invite code, please try again',
    },
    CodeTitle: {
        id: 'general_tab.codeTitle',
        defaultMessage: 'Invite Code',
    },
    CodeLongDesc: {
        id: 'general_tab.codeLongDesc',
        defaultMessage: 'The Invite Code is part of the unique team invitation link which is sent to members you’re inviting to this team. Regenerating the code creates a new invitation link and invalidates the previous link.',
    },
});

const generateAllowedDomainOptions = (allowedDomains?: string) => {
    if (!allowedDomains || allowedDomains.length === 0) {
        return [];
    }
    const domainList = allowedDomains.includes(',') ? allowedDomains.split(',') : [allowedDomains];
    return domainList.map((domain) => domain.trim());
};

type Props = PropsFromRedux & OwnProps;

const AccessTab = ({canInviteTeamMembers, closeModal, collapseModal, hasChangeTabError, hasChanges, setHasChangeTabError, setHasChanges, team, actions}: Props) => {
    const [inviteId, setInviteId] = useState<Team['invite_id']>(team?.invite_id ?? '');
    const [allowedDomains, setAllowedDomains] = useState<string[]>(() => generateAllowedDomainOptions(team?.allowed_domains));
    const [allowOpenInvite, setAllowOpenInvite] = useState<boolean>(team?.allow_open_invite ?? false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [inviteIdError, setInviteIdError] = useState<BaseSettingItemProps['error'] | undefined>();
    const {formatMessage} = useIntl();

    useEffect(() => {
        setInviteId(team?.invite_id || '');
    }, [team?.invite_id]);

    const handleAllowedDomainsSubmit = useCallback(async (): Promise<boolean> => {
        const {error} = await actions.patchTeam({
            id: team?.id,
            allowed_domains: allowedDomains.length === 1 ? allowedDomains[0] : allowedDomains.join(', '),
        });
        if (error) {
            return false;
        }
        return true;
    }, [actions, allowedDomains, team?.id]);

    const handleOpenInviteSubmit = useCallback(async (): Promise<boolean> => {
        if (allowOpenInvite === team?.allow_open_invite) {
            return true;
        }
        const data = {
            id: team?.id,
            allow_open_invite: allowOpenInvite,
        };

        const {error} = await actions.patchTeam(data);
        if (error) {
            return false;
        }
        return true;
    }, [actions, allowOpenInvite, team?.allow_open_invite, team?.id]);

    const updateOpenInvite = useCallback((value: boolean) => {
        setHasChanges(true);
        setSaveChangesPanelState('editing');
        setAllowOpenInvite(value);
    }, [setHasChanges]);
    const handleRegenerateInviteId = useCallback(async () => {
        const {data, error} = await actions.regenerateTeamInviteId(team?.id || '');

        if (data?.invite_id) {
            setInviteId(data.invite_id);
            return;
        }

        if (error) {
            setInviteIdError(translations.OpenInviteDescriptionError);
        }
    }, [actions, team?.id]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState('editing');
        setHasChanges(false);
        setHasChangeTabError(false);
    }, [setHasChangeTabError, setHasChanges]);

    const handleCancel = useCallback(() => {
        setAllowedDomains(generateAllowedDomainOptions(team?.allowed_domains));
        setAllowOpenInvite(team?.allow_open_invite ?? false);
        handleClose();
    }, [handleClose, team?.allow_open_invite, team?.allowed_domains]);

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

    let inviteSection;
    if (canInviteTeamMembers) {
        const inviteSectionInput = (
            <div
                data-testid='teamInviteContainer'
                id='teamInviteContainer'
            >
                <Input
                    id='teamInviteId'
                    type='text'
                    value={inviteId}
                    maxLength={32}
                />
                <button
                    data-testid='regenerateButton'
                    id='regenerateButton'
                    className='btn btn-tertiary'
                    onClick={handleRegenerateInviteId}
                >
                    <RefreshIcon/>
                    {formatMessage({id: 'general_tab.regenerate', defaultMessage: 'Regenerate'})}
                </button>
            </div>
        );

        inviteSection = (
            <BaseSettingItem
                className='access-invite-section'
                title={translations.CodeTitle}
                description={translations.CodeLongDesc}
                content={inviteSectionInput}
                error={inviteIdError}
                descriptionAboveContent={true}
            />
        );
    }

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
                    <div className='modal-access-tab-content user-settings'>
                        {team?.group_constrained ?
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
                            isGroupConstrained={team?.group_constrained}
                            allowOpenInvite={allowOpenInvite}
                            setAllowOpenInvite={updateOpenInvite}
                        />
                        <div className='divider-light'/>
                        {team?.group_constrained ? undefined : inviteSection}
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
