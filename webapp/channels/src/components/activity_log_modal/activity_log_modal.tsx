// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {Session} from '@mattermost/types/sessions';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ActivityLog from 'components/activity_log_modal/components/activity_log';

export type Props = {

    /**
     * The current user id
     */
    currentUserId: string;

    /**
     * Current user's sessions
     */
    sessions: Session[];

    /**
     * Current user's locale
     */
    locale: string;

    /**
     * Function that's called when user closes the modal
     */
    onHide: () => void;

    actions: {

        /**
         * Function to refresh sessions from server
         */
        getSessions: (userId: string) => void;

        /**
         * Function to revoke a particular session
         */
        revokeSession: (userId: string, sessionId: string) => Promise<ActionResult>;
    };
}

type State = {
    show: boolean;
}

export default class ActivityLogModal extends React.PureComponent<Props, State> {
    static propTypes = {

    };

    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    submitRevoke = (altId: string, e: React.MouseEvent) => {
        e.preventDefault();
        const modalContent = (e.target as Element)?.closest('.modal-content');
        modalContent?.classList.add('animation--highlight');
        setTimeout(() => {
            modalContent?.classList.remove('animation--highlight');
        }, 1500);
        this.props.actions.revokeSession(this.props.currentUserId, altId).then(() => {
            this.props.actions.getSessions(this.props.currentUserId);
        });
    };

    onShow = () => {
        this.props.actions.getSessions(this.props.currentUserId);
    };

    onHide = () => {
        this.setState({show: false});
    };

    componentDidMount() {
        this.onShow();
    }

    render() {
        const activityList = this.props.sessions.reduce((array: JSX.Element[], currentSession, index) => {
            if (currentSession.props.type === 'UserAccessToken') {
                return array;
            }

            array.push(
                <ActivityLog
                    key={currentSession.id}
                    index={index}
                    locale={this.props.locale}
                    currentSession={currentSession}
                    submitRevoke={this.submitRevoke}
                />,
            );
            return array;
        }, []);

        const content = <form role='form'>{activityList}</form>;

        return (
            <Modal
                dialogClassName='a11y__modal modal--scroll'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
                bsSize='large'
                role='dialog'
                aria-labelledby='activityLogModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='activityLogModalLabel'
                    >
                        <FormattedMessage
                            id='activity_log.activeSessions'
                            defaultMessage='Active Sessions'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className='session-help-text'>
                        <FormattedMessage
                            id='activity_log.sessionsDescription'
                            defaultMessage="Sessions are created when you log in through a new browser on a device. Sessions let you use Mattermost without having to log in again for a time period specified by the system administrator. To end the session sooner, use the 'Log Out' button."
                        />
                    </p>
                    {content}
                </Modal.Body>
                <Modal.Footer className='modal-footer--invisible'>
                    <button
                        id='closeModalButton'
                        type='button'
                        className='btn btn-tertiary'
                    >
                        <FormattedMessage
                            id='general_button.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
