// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useCallback} from 'react';
import {Modal, type ModalBody} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import ModalSidebar from 'components/widgets/modals/components/modal_sidebar';

import AdvancedDisplaySettings from './advanced_display_settings';
import {useUserSettingsTabs} from './utils';
import './user_settings_modal.scss';

type Props = {
    onExited: () => void;
}

const UserSettingsModal = ({onExited}: Props) => {
    const [activeTab, setActiveTab] = useState('advanced');
    const [show, setShow] = useState<boolean>(true);
    const modalBodyRef = useRef<ModalBody>(null);
    const {formatMessage} = useIntl();
    const tabs = useUserSettingsTabs();

    const updateTab = useCallback((tab: string) => {
        setActiveTab(tab);
    }, []);

    const handleHide = useCallback(() => setShow(false), []);

    const handleClose = useCallback(() => {
        setActiveTab('info');
        onExited();
    }, [onExited]);

    return (
        <Modal
            dialogClassName='a11y__modal settings-modal'
            show={show}
            onHide={handleHide}
            onExited={handleClose}
            role='dialog'
            aria-labelledby='userettingsModalLabel'
            id='userSettingsModal'
        >
            <Modal.Header
                id='userSettingsModalLabel'
                closeButton={true}
            >
                <Modal.Title componentClass='h1'>
                    {formatMessage({id: 'user_settings_modal.title', defaultMessage: 'Settings'})}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body ref={modalBodyRef}>
                <div className='user-settings-modal__body'>
                    <div className='user-settings-modal__sidebar'>
                        <React.Suspense fallback={null}>
                            <ModalSidebar
                                tabs={tabs}
                                activeTab={activeTab}
                                updateTab={updateTab}
                            />
                        </React.Suspense>
                    </div>
                    <div className='user-settings-modal__content'>
                        {activeTab === 'advanced' && (
                            <AdvancedDisplaySettings/>
                        )}
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default UserSettingsModal;
