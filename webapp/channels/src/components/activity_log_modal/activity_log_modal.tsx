// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Session} from '@mattermost/types/sessions';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ActivityLog from 'components/activity_log_modal/components/activity_log';

import './activity_log_modal.scss';

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

const ActivityLogModal = ({
    currentUserId,
    sessions,
    locale,
    onHide,
    actions: {
        getSessions,
        revokeSession,
    },
}: Props) => {
    const submitRevoke = useCallback((altId: string, e: React.MouseEvent) => {
        e.preventDefault();
        const modalContent = (e.target as Element)?.closest('.modal-content');
        modalContent?.classList.add('animation--highlight');
        setTimeout(() => {
            modalContent?.classList.remove('animation--highlight');
        }, 1500);
        revokeSession(currentUserId, altId).then(() => {
            getSessions(currentUserId);
        });
    }, [currentUserId, revokeSession, getSessions]);

    useEffect(() => {
        getSessions(currentUserId);
    }, [currentUserId, getSessions]);

    const activityList = useMemo(() => {
        return sessions.reduce((array: JSX.Element[], currentSession, index) => {
            if (currentSession.props.type === 'UserAccessToken') {
                return array;
            }

            array.push(
                <ActivityLog
                    key={currentSession.id}
                    index={index}
                    locale={locale}
                    currentSession={currentSession}
                    submitRevoke={submitRevoke}
                />,
            );
            return array;
        }, []);
    }, [sessions, locale, submitRevoke]);

    const content = <form>{activityList}</form>;

    return (
        <GenericModal
            id='activityLogModal'
            className='activity-log-modal modal--scroll'
            modalHeaderText={
                <FormattedMessage
                    id='activity_log.activeSessions'
                    defaultMessage='Active Sessions'
                />
            }
            show={true}
            onHide={onHide}
            ariaLabelledby='activityLogModalLabel'
            modalLocation='top'
            isStacked={true}
            compassDesign={true}
        >
            <div className='activity-log-modal__body'>
                <p className='session-help-text'>
                    <FormattedMessage
                        id='activity_log.sessionsDescription'
                        defaultMessage="Sessions are created when you log in through a new browser on a device. Sessions let you use Mattermost without having to log in again for a time period specified by the system administrator. To end the session sooner, use the 'Log Out' button."
                    />
                </p>
                {content}
            </div>
        </GenericModal>
    );
};

export default React.memo(ActivityLogModal);
