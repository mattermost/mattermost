// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useCallback} from 'react';
import {Modal, type ModalBody} from 'react-bootstrap';
import ReactDOM from 'react-dom';
import {useIntl} from 'react-intl';

import TeamSettings from 'components/team_settings';

import {focusElement} from 'utils/a11y_utils';

const SettingsSidebar = React.lazy(() => import('components/settings_sidebar'));

type Props = {
    onExited: () => void;
    canInviteUsers: boolean;
    focusOriginElement?: string;
}

const TeamSettingsModal = ({onExited, canInviteUsers, focusOriginElement}: Props) => {
    const [activeTab, setActiveTab] = useState('info');
    const [show, setShow] = useState<boolean>(true);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [hasChangeTabError, setHasChangeTabError] = useState<boolean>(false);
    const modalBodyRef = useRef<ModalBody>(null);
    const {formatMessage} = useIntl();

    const updateTab = useCallback((tab: string) => {
        if (hasChanges) {
            setHasChangeTabError(true);
            return;
        }
        setActiveTab(tab);
        setHasChanges(false);
        setHasChangeTabError(false);
    }, [hasChanges]);

    const handleHide = useCallback(() => setShow(false), []);

    const handleClose = useCallback(() => {
        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }
        setActiveTab('info');
        setHasChanges(false);
        setHasChangeTabError(false);
        onExited();
    }, [onExited, focusOriginElement]);

    const handleCollapse = useCallback(() => {
        const el = ReactDOM.findDOMNode(modalBodyRef.current) as HTMLDivElement;
        el?.closest('.modal-dialog')!.classList.remove('display--content');
        setActiveTab('');
    }, []);

    const tabs = [
        {name: 'info', uiName: formatMessage({id: 'team_settings_modal.infoTab', defaultMessage: 'Info'}), icon: 'icon icon-information-outline', iconTitle: formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'})},
    ];
    if (canInviteUsers) {
        tabs.push({name: 'access', uiName: formatMessage({id: 'team_settings_modal.accessTab', defaultMessage: 'Access'}), icon: 'icon icon-account-multiple-outline', iconTitle: formatMessage({id: 'generic_icons.member', defaultMessage: 'Member Icon'})});
    }

    return (
        <Modal
            dialogClassName='a11y__modal settings-modal'
            show={show}
            onHide={handleHide}
            onExited={handleClose}
            role='none'
            aria-labelledby='teamSettingsModalLabel'
            id='teamSettingsModal'
        >
            <Modal.Header
                id='teamSettingsModalLabel'
                closeButton={true}
            >
                <Modal.Title
                    componentClass='h2'
                    className='modal-header__title'
                >
                    {formatMessage({id: 'team_settings_modal.title', defaultMessage: 'Team Settings'})}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body ref={modalBodyRef}>
                <div className='settings-table'>
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
                            hasChanges={hasChanges}
                            setHasChanges={setHasChanges}
                            hasChangeTabError={hasChangeTabError}
                            setHasChangeTabError={setHasChangeTabError}
                            closeModal={handleHide}
                            collapseModal={handleCollapse}
                        />
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default TeamSettingsModal;
