// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef} from 'react';
import {Modal, type ModalBody} from 'react-bootstrap';
import ReactDOM from 'react-dom';
import {useIntl} from 'react-intl';

import TeamSettings from 'components/team_settings';

const SettingsSidebar = React.lazy(() => import('components/settings_sidebar'));

type Props = {
    onExited: () => void;
}

const TeamSettingsModal = (props: Props) => {
    const [activeTab, setActiveTab] = useState('info');
    const [show, setShow] = useState<boolean>(true);
    const modalBodyRef = useRef<ModalBody>(null);
    const {formatMessage} = useIntl();

    const updateTab = (tab: string) => setActiveTab(tab);

    const collapseModal = () => {
        const el = ReactDOM.findDOMNode(modalBodyRef.current) as HTMLDivElement;
        const modalDialog = el.closest('.modal-dialog');
        modalDialog?.classList.remove('display--content');

        setActiveTab('');
    };

    const handleHide = () => setShow(false);

    // called after the dialog is fully hidden and faded out
    const handleHidden = () => {
        setActiveTab('info');
        props.onExited();
    };

    const tabs = [];
    tabs.push({name: 'info', uiName: formatMessage({id: 'team_settings_modal.infoTab', defaultMessage: 'Info'}), icon: 'icon icon-information-outline', iconTitle: formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'})});
    tabs.push({name: 'access', uiName: formatMessage({id: 'team_settings_modal.accessTab', defaultMessage: 'Access'}), icon: 'icon icon-account-multiple-outline', iconTitle: formatMessage({id: 'generic_icons.member', defaultMessage: 'Member Icon'})});

    return (
        <Modal
            dialogClassName='a11y__modal settings-modal settings-modal--action'
            show={show}
            onHide={handleHide}
            onExited={handleHidden}
            role='dialog'
            aria-labelledby='teamSettingsModalLabel'
            id='teamSettingsModal'
        >
            <Modal.Header
                id='teamSettingsModalLabel'
                closeButton={true}
            >
                <Modal.Title componentClass='h1'>
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
                            closeModal={handleHide}
                            collapseModal={collapseModal}
                        />
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default TeamSettingsModal;
