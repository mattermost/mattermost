// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {Provider} from 'react-redux';
import ReactDOM from 'react-dom';
import {
    FormattedMessage,
    useIntl,
} from 'react-intl';

import store from 'stores/redux_store';
import Constants from 'utils/constants';
import * as Utils from 'utils/utils';
import ConfirmModal from 'components/confirm_modal';

import {CloseIcon} from '@mattermost/compass-icons/components';

import TextInput from '@mattermost/compass-components/components/text-input';

import {StatusOK} from '@mattermost/types/client4';
import {UserProfile} from '@mattermost/types/users';
import {holders, useUserSettingsTabs} from './../utils';

import './user_settings_modal.scss';

const UserSettings = React.lazy(() => import(/* webpackPrefetch: true */ 'components/user_settings'));
const ModalSidebar = React.lazy(() => import(/* webpackPrefetch: true */ 'components/widgets/modals/components/modal_sidebar'));

export type Props = {
    currentUser: UserProfile;
    onExited: () => void;
    isContentProductSettings: boolean;
    actions: {
        sendVerificationEmail: (email: string) => Promise<{
            data: StatusOK;
            error: {
                err: string;
            };
        }>;
    };
}

function UserSettingsModal(props: Props): JSX.Element {
    let requireConfirm = false;
    let customConfirmAction: ((handleConfirm: () => void) => void) | null = null;
    const modalBodyRef = useRef<Modal>(null);
    let afterConfirm: (() => void) | null = null;

    const [activeTab, setActiveTab] = useState<string>(props.isContentProductSettings ? 'themes' : 'profile');
    const [activeSection, setActiveSection] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [enforceFocus, setEnforceFocus] = useState(true);
    const [show, setShow] = useState(true);

    const {formatMessage} = useIntl();
    const tabs = useUserSettingsTabs();

    // Called when the close button is pressed on the main modal
    const handleHide = useCallback(() => {
        if (requireConfirm) {
            showConfirmModalFunc(() => handleHide());
            return;
        }

        setShow(false);
    }, [requireConfirm, setShowConfirmModal]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (Utils.cmdOrCtrlPressed(e) && e.shiftKey && Utils.isKeyPressed(e, Constants.KeyCodes.A)) {
                e.preventDefault();
                handleHide();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleHide]);

    useEffect(() => {
        const el = modalBodyRef.current;

        // const componentRef = useRef(null);
        //
        // const handleClick = () => {
        //     componentREf.current.scrollTo(0, 0);
        // };
        //
        // return (
        //     <div ref={componentRef}>
        //         ...
        //         <button onClick={handleClick}> Reset scroll </button>
        //     </div>
        // )
    }, [activeTab]);

    // called after the dialog is fully hidden and faded out
    function handleHidden() {
        setActiveTab(props.isContentProductSettings ? 'notifications' : 'profile');
        setActiveSection('');
        props.onExited();
    }

    // Called to hide the settings pane when on mobile
    function handleCollapse() {
        const el = ReactDOM.findDOMNode(modalBodyRef.current) as HTMLDivElement;
        el.closest('.modal-dialog')!.classList.remove('display--content');
        setActiveTab('');
        setActiveSection('');
    }

    function handleConfirm() {
        setShowConfirmModal(false);
        setEnforceFocus(true);

        requireConfirm = false;
        customConfirmAction = null;

        if (afterConfirm) {
            afterConfirm();
            afterConfirm = null;
        }
    }

    const handleCancelConfirmation = () => {
        setShowConfirmModal(false);
        setEnforceFocus(true);
        afterConfirm = null;
    };

    function showConfirmModalFunc(afterConfirmParam: () => void) {
        if (afterConfirmParam) {
            afterConfirm = afterConfirmParam;
        }

        if (customConfirmAction) {
            customConfirmAction(handleConfirm);
            return;
        }
        setShowConfirmModal(true);
        setEnforceFocus(false);
    }

    // Called by settings tabs when their close button is pressed
    function closeModal() {
        if (requireConfirm) {
            showConfirmModalFunc(closeModal);
        } else {
            handleHide();
        }
    }

    // Called by settings tabs when their back button is pressed
    function collapseModal() {
        if (requireConfirm) {
            showConfirmModalFunc(collapseModal);
        } else {
            handleCollapse();
        }
    }

    function updateTab(tab?: string, skipConfirm?: boolean) {
        if (!skipConfirm && requireConfirm) {
            showConfirmModalFunc(() => updateTab(tab, true));
        } else {
            setActiveTab(tab || '');
            setActiveSection('');
        }
    }

    function updateSection(section?: string, skipConfirm?: boolean) {
        if (!skipConfirm && requireConfirm) {
            showConfirmModalFunc(() => updateSection(section, true));
        } else {
            setActiveSection(section || '');
        }
    }

    if (props.currentUser == null) {
        return (<div/>);
    }

    // const tabs = [];
    // if (this.props.isContentProductSettings) {
    //     tabs.push({name: 'notifications', uiName: formatMessage(holders.notifications), icon: 'icon fa fa-exclamation-circle', iconTitle: Utils.localizeMessage('user.settings.notifications.icon', 'Notification Settings Icon')});
    //     tabs.push({name: 'display', uiName: formatMessage(holders.display), icon: 'icon fa fa-eye', iconTitle: Utils.localizeMessage('user.settings.display.icon', 'Display Settings Icon')});
    //     tabs.push({name: 'sidebar', uiName: formatMessage(holders.sidebar), icon: 'icon fa fa-columns', iconTitle: Utils.localizeMessage('user.settings.sidebar.icon', 'Sidebar Settings Icon')});
    //     tabs.push({name: 'advanced', uiName: formatMessage(holders.advanced), icon: 'icon fa fa-list-alt', iconTitle: Utils.localizeMessage('user.settings.advance.icon', 'Advanced Settings Icon')});
    // } else {
    //     tabs.push({name: 'profile', uiName: formatMessage(holders.profile), icon: 'icon fa fa-gear', iconTitle: Utils.localizeMessage('user.settings.profile.icon', 'Profile Settings Icon')});
    //     tabs.push({name: 'security', uiName: formatMessage(holders.security), icon: 'icon fa fa-lock', iconTitle: Utils.localizeMessage('user.settings.security.icon', 'Security Settings Icon')});
    // }

    return (
        <Modal
            id='accountSettingsModal'
            dialogClassName='a11y__modal settings-modal user-settings-modal'
            show={show}
            onHide={handleHide}
            onExited={handleHidden}
            enforceFocus={enforceFocus}
            role='dialog'
            aria-labelledby='accountSettingsModalLabel'
        >
            <Modal.Header
                id='accountSettingsHeader'
                closeButton={false}
                className='user-settings-modal__header'
            >
                <h1
                    id='accountSettingsModalLabel'
                    className='user-settings-modal__heading'
                    tabIndex={0}
                >
                    {props.isContentProductSettings ? (
                        <FormattedMessage
                            id='global_header.productSettings'
                            defaultMessage='Preferences'
                        />
                    ) : (
                        <FormattedMessage
                            id='user.settings.modal.title'
                            defaultMessage='Profile'
                        />
                    )}
                </h1>
                <div className='user-settings-modal__search-ctr'>
                    <TextInput
                        className='user-settings-modal__search'
                        leadingIcon={'magnify'}
                        placeholder={'Search preferences'}
                    >
                        {'Search Preferences'}
                    </TextInput>
                    <CloseIcon
                        size={24}
                        color={'currentcolor'}
                    />
                </div>
            </Modal.Header>
            <Modal.Body ref={modalBodyRef}>
                <div className='user-settings-modal__body'>
                    <div className='user-settings-modal__sidebar'>
                        <React.Suspense fallback={null}>
                            <Provider store={store}>
                                <ModalSidebar
                                    tabs={tabs}
                                    activeTab={activeTab}
                                    updateTab={updateTab}
                                />
                            </Provider>
                        </React.Suspense>
                    </div>
                    <div className='user-settings-modal__content'>
                        <React.Suspense fallback={null}>
                            <Provider store={store}>
                                <UserSettings
                                    activeTab={activeTab}
                                    activeSection={activeSection}
                                    updateSection={updateSection}
                                    updateTab={updateTab}
                                    closeModal={closeModal}
                                    collapseModal={collapseModal}
                                    setEnforceFocus={(enforceFocus?: boolean) => setEnforceFocus(enforceFocus || false)}
                                    setRequireConfirm={
                                        (requireConfirmParam?: boolean, customConfirmActionParam?: () => () => void) => {
                                            requireConfirm = requireConfirmParam!;
                                            customConfirmAction = customConfirmActionParam!;
                                        }
                                    }
                                />
                            </Provider>
                        </React.Suspense>
                    </div>
                </div>
            </Modal.Body>
            <ConfirmModal
                title={formatMessage(holders.confirmTitle)}
                message={formatMessage(holders.confirmMsg)}
                confirmButtonText={formatMessage(holders.confirmBtns)}
                show={showConfirmModal}
                onConfirm={handleConfirm}
                onCancel={handleCancelConfirmation}
            />
        </Modal>
    );
}

export default UserSettingsModal;
