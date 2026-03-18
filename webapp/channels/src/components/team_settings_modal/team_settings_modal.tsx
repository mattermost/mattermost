// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {Permissions} from 'mattermost-redux/constants';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import TeamSettings from 'components/team_settings';

import {focusElement} from 'utils/a11y_utils';

import type {GlobalState} from 'types/store';

import './team_settings_modal.scss';

const SettingsSidebar = React.lazy(() => import('components/settings_sidebar'));

const SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT = 3000;

type Props = {
    isOpen: boolean;
    onExited: () => void;
    focusOriginElement?: string;
}

const TeamSettingsModal = ({isOpen, onExited, focusOriginElement}: Props) => {
    const [activeTab, setActiveTab] = useState('info');
    const [show, setShow] = useState(isOpen);
    const [areThereUnsavedChanges, setAreThereUnsavedChanges] = useState(false);
    const [showTabSwitchError, setShowTabSwitchError] = useState(false);
    const [hasBeenWarned, setHasBeenWarned] = useState(false);
    const modalBodyRef = useRef<HTMLDivElement>(null);
    const {formatMessage} = useIntl();

    const teamId = useSelector(getCurrentTeamId);
    const canInviteUsers = useSelector((state: GlobalState) =>
        haveITeamPermission(state, teamId, Permissions.INVITE_USER),
    );

    useEffect(() => {
        setShow(isOpen);
    }, [isOpen]);

    const updateTab = useCallback((tab: string) => {
        if (areThereUnsavedChanges) {
            setShowTabSwitchError(true);
            setTimeout(() => {
                setShowTabSwitchError(false);
            }, SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT);
            return;
        }
        setActiveTab(tab);

        if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    }, [areThereUnsavedChanges]);

    const handleHide = useCallback(() => {
        // Prevent modal closing if there are unsaved changes (warn once, then allow)
        if (areThereUnsavedChanges && !hasBeenWarned) {
            setHasBeenWarned(true);
            setShowTabSwitchError(true);
            setTimeout(() => {
                setShowTabSwitchError(false);
            }, SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT);
        } else {
            handleHideConfirm();
        }
    }, [areThereUnsavedChanges, hasBeenWarned]);

    const handleHideConfirm = useCallback(() => {
        setShow(false);
    }, []);

    const handleExited = useCallback(() => {
        // Reset all state
        setActiveTab('info');
        setAreThereUnsavedChanges(false);
        setShowTabSwitchError(false);
        setHasBeenWarned(false);

        // Restore focus
        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }

        // Notify parent
        onExited();
    }, [onExited, focusOriginElement]);

    const tabs = [
        {
            name: 'info',
            uiName: formatMessage({id: 'team_settings_modal.infoTab', defaultMessage: 'Info'}),
            icon: 'icon icon-information-outline',
            iconTitle: formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'}),
        },
        {
            name: 'access',
            uiName: formatMessage({id: 'team_settings_modal.accessTab', defaultMessage: 'Access'}),
            icon: 'icon icon-account-multiple-outline',
            iconTitle: formatMessage({id: 'generic_icons.member', defaultMessage: 'Member Icon'}),
            display: canInviteUsers,
        },
    ];

    const modalTitle = formatMessage({id: 'team_settings_modal.title', defaultMessage: 'Team Settings'});

    return (
        <GenericModal
            id='teamSettingsModal'
            ariaLabel={modalTitle}
            className='TeamSettingsModal settings-modal'
            show={show}
            onHide={handleHide}
            preventClose={areThereUnsavedChanges && !hasBeenWarned}
            onExited={handleExited}
            compassDesign={true}
            modalHeaderText={modalTitle}
            bodyPadding={false}
            modalLocation={'top'}
            enforceFocus={false}
        >
            <div className='TeamSettingsModal__bodyWrapper'>
                <div
                    ref={modalBodyRef}
                    className='settings-table'
                >
                    <div className='settings-links'>
                        <React.Suspense fallback={null}>
                            <SettingsSidebar
                                tabs={tabs}
                                activeTab={activeTab}
                                updateTab={updateTab}
                            />
                        </React.Suspense>
                    </div>
                    <div className='settings-content minimize-settings'>
                        <TeamSettings
                            activeTab={activeTab}
                            areThereUnsavedChanges={areThereUnsavedChanges}
                            setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                            showTabSwitchError={showTabSwitchError}
                            setShowTabSwitchError={setShowTabSwitchError}
                        />
                    </div>
                </div>
            </div>
        </GenericModal>
    );
};

export default TeamSettingsModal;
