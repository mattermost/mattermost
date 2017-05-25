// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from 'components/loading_screen.jsx';

import UserStore from 'stores/user_store.jsx';

import * as Utils from 'utils/utils.jsx';

import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, FormattedTime, FormattedDate} from 'react-intl';

export default class ActivityLogModal extends React.Component {
    static propTypes = {
        onHide: PropTypes.func.isRequired,
        actions: PropTypes.shape({
            getSessions: PropTypes.func.isRequired,
            revokeSession: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.submitRevoke = this.submitRevoke.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleMoreInfo = this.handleMoreInfo.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onShow = this.onShow.bind(this);

        const state = this.getStateFromStores();
        state.moreInfo = [];
        state.show = true;

        this.state = state;
    }

    getStateFromStores() {
        return {
            sessions: UserStore.getSessions(),
            clientError: null
        };
    }

    submitRevoke(altId, e) {
        e.preventDefault();
        var modalContent = $(e.target).closest('.modal-content');
        modalContent.addClass('animation--highlight');
        setTimeout(() => {
            modalContent.removeClass('animation--highlight');
        }, 1500);
        this.props.actions.revokeSession(UserStore.getCurrentId(), altId).then(() => {
            this.props.actions.getSessions(UserStore.getCurrentId());
        });
    }

    onShow() {
        this.props.actions.getSessions(UserStore.getCurrentId());
        if (!Utils.isMobile()) {
            $('.modal-body').perfectScrollbar();
        }
    }

    onHide() {
        this.setState({show: false});
    }

    componentDidMount() {
        UserStore.addSessionsChangeListener(this.onListenerChange);
        this.onShow();
    }

    componentWillUnmount() {
        UserStore.removeSessionsChangeListener(this.onListenerChange);
    }

    onListenerChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(newState.sessions, this.state.sessions)) {
            this.setState(newState);
        }
    }

    handleMoreInfo(index) {
        const newMoreInfo = this.state.moreInfo;
        newMoreInfo[index] = true;
        this.setState({moreInfo: newMoreInfo});
    }

    render() {
        const activityList = [];

        for (let i = 0; i < this.state.sessions.length; i++) {
            const currentSession = this.state.sessions[i];
            const lastAccessTime = new Date(currentSession.last_activity_at);
            const firstAccessTime = new Date(currentSession.create_at);
            let devicePlatform = currentSession.props.platform;
            let devicePicture = '';

            if (currentSession.props.platform === 'Windows') {
                devicePicture = 'fa fa-windows';
            } else if (currentSession.device_id && currentSession.device_id.indexOf('apple') === 0) {
                devicePicture = 'fa fa-apple';
                devicePlatform = (
                    <FormattedMessage
                        id='activity_log_modal.iphoneNativeApp'
                        defaultMessage='iPhone Native App'
                    />
                );
            } else if (currentSession.device_id && currentSession.device_id.indexOf('android') === 0) {
                devicePlatform = (
                    <FormattedMessage
                        id='activity_log_modal.androidNativeApp'
                        defaultMessage='Android Native App'
                    />
                );
                devicePicture = 'fa fa-android';
            } else if (currentSession.props.platform === 'Macintosh' ||
                currentSession.props.platform === 'iPhone') {
                devicePicture = 'fa fa-apple';
            } else if (currentSession.props.platform === 'Linux') {
                if (currentSession.props.os.indexOf('Android') >= 0) {
                    devicePlatform = (
                        <FormattedMessage
                            id='activity_log_modal.android'
                            defaultMessage='Android'
                        />
                    );
                    devicePicture = 'fa fa-android';
                } else {
                    devicePicture = 'fa fa-linux';
                }
            } else if (currentSession.props.os.indexOf('Linux') !== -1) {
                devicePicture = 'fa fa-linux';
            }

            if (currentSession.props.browser.indexOf('Desktop App') !== -1) {
                devicePlatform = (
                    <FormattedMessage
                        id='activity_log_modal.desktop'
                        defaultMessage='Native Desktop App'
                    />
                );
            }

            let moreInfo;
            if (this.state.moreInfo[i]) {
                moreInfo = (
                    <div>
                        <div>
                            <FormattedMessage
                                id='activity_log.firstTime'
                                defaultMessage='First time active: {date}, {time}'
                                values={{
                                    date: (
                                        <FormattedDate
                                            value={firstAccessTime}
                                            day='2-digit'
                                            month='long'
                                            year='numeric'
                                        />
                                    ),
                                    time: (
                                        <FormattedTime
                                            value={firstAccessTime}
                                            hour='2-digit'
                                            minute='2-digit'
                                        />
                                    )
                                }}
                            />
                        </div>
                        <div>
                            <FormattedMessage
                                id='activity_log.os'
                                defaultMessage='OS: {os}'
                                values={{
                                    os: currentSession.props.os
                                }}
                            />
                        </div>
                        <div>
                            <FormattedMessage
                                id='activity_log.browser'
                                defaultMessage='Browser: {browser}'
                                values={{
                                    browser: currentSession.props.browser
                                }}
                            />
                        </div>
                        <div>
                            <FormattedMessage
                                id='activity_log.sessionId'
                                defaultMessage='Session ID: {id}'
                                values={{
                                    id: currentSession.id
                                }}
                            />
                        </div>
                    </div>
                );
            } else {
                moreInfo = (
                    <a
                        className='theme'
                        href='#'
                        onClick={this.handleMoreInfo.bind(this, i)}
                    >
                        <FormattedMessage
                            id='activity_log.moreInfo'
                            defaultMessage='More info'
                        />
                    </a>
                );
            }

            activityList[i] = (
                <div
                    key={'activityLogEntryKey' + i}
                    className='activity-log__table'
                >
                    <div className='activity-log__report'>
                        <div className='report__platform'><i className={devicePicture}/>{devicePlatform}</div>
                        <div className='report__info'>
                            <div>
                                <FormattedMessage
                                    id='activity_log.lastActivity'
                                    defaultMessage='Last activity: {date}, {time}'
                                    values={{
                                        date: (
                                            <FormattedDate
                                                value={lastAccessTime}
                                                day='2-digit'
                                                month='long'
                                                year='numeric'
                                            />
                                        ),
                                        time: (
                                            <FormattedTime
                                                value={lastAccessTime}
                                                hour='2-digit'
                                                minute='2-digit'
                                            />
                                        )
                                    }}
                                />
                            </div>
                            {moreInfo}
                        </div>
                    </div>
                    <div className='activity-log__action'>
                        <button
                            onClick={this.submitRevoke.bind(this, currentSession.id)}
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='activity_log.logout'
                                defaultMessage='Logout'
                            />
                        </button>
                    </div>
                </div>
            );
        }

        let content;
        if (this.state.sessions.loading) {
            content = <LoadingScreen/>;
        } else {
            content = <form role='form'>{activityList}</form>;
        }

        return (
            <Modal
                dialogClassName='modal--scroll'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
                bsSize='large'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='activity_log.activeSessions'
                            defaultMessage='Active Sessions'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    <p className='session-help-text'>
                        <FormattedMessage
                            id='activity_log.sessionsDescription'
                            defaultMessage="Sessions are created when you log in to a new browser on a device. Sessions let you use Mattermost without having to log in again for a time period specified by the System Admin. If you want to log out sooner, use the 'Logout' button below to end a session."
                        />
                    </p>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}
