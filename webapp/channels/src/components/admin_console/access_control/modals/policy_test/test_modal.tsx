// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {AccessControlTestResult} from '@mattermost/types/access_control';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import type {ModalData} from 'types/actions';
import type {ActionFuncAsync} from 'types/store';

import TestChannelPicker from './test_channel_picker';

import './test_modal.scss';

const USERS_TO_FETCH = 50;
const USERS_PER_PAGE = 10;

type Props = {
    onExited: () => void;
    isStacked?: boolean;

    /**
     * Show a channel-picker step before the members list. Used for a
     * resource.attributes.* rule the editor has no channel scope for: the
     * picked channel id is threaded into searchUsers so the rule can be
     * resolved against that channel's attribute values. When false the modal
     * opens straight to the members list, unchanged.
     */
    requireChannel?: boolean;
    actions: {
        searchUsers: (term: string, after: string, limit: number, channelId?: string) => ActionFuncAsync<AccessControlTestResult>;
        openModal?: <P>(modalData: ModalData<P>) => void;
    };
};

function TestResultsModal({
    onExited,
    isStacked = false,
    requireChannel = false,
    actions,
}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [term, setTerm] = useState<string>('');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]); // Stores the 'after' cursor for page 1, page 2, etc.

    // Channel chosen in the picker step. Undefined until a channel is picked
    // (or always, when requireChannel is false — the editor already supplies
    // its channel through searchUsers).
    const [channelId, setChannelId] = useState<string | undefined>(undefined);
    const showPicker = requireChannel && !channelId;

    const fetchUsers = useCallback(async (searchTerm: string, cursor: string, reset: boolean = false, channelOverride?: string) => {
        setLoading(true);
        const result: ActionResult<AccessControlTestResult> = await dispatch(actions.searchUsers(searchTerm, cursor, USERS_TO_FETCH, channelOverride ?? channelId));
        if (result?.data) {
            const newUsers = result.data.users;
            if (reset) {
                setUsers(newUsers);
            } else {
                setUsers((prevUsers) => [...prevUsers, ...newUsers]);
            }
            setTotal(result.data.total);
        } else {
            setUsers([]);
            setTotal(0);
        }
        setLoading(false);
    }, [dispatch, actions, channelId]);

    useEffect(() => {
        // The picker step defers the initial fetch until a channel is chosen
        // (handled in handleChannelSelected).
        if (!requireChannel) {
            fetchUsers('', '');
        }
    }, []);

    const handleChannelSelected = (selectedChannelId: string) => {
        setChannelId(selectedChannelId);
        setTerm('');
        setCursorHistory([]);
        fetchUsers('', '', true, selectedChannelId);
    };

    const handleBack = () => {
        setChannelId(undefined);
        setUsers([]);
        setTotal(0);
    };

    const handleSearch = (newTerm: string) => {
        setCursorHistory([]);
        setTerm(newTerm);
        fetchUsers(newTerm, '', true);
    };

    const handleNextPage = (page: number) => {
        if (loading || !users.length) {
            return;
        }
        if (page * USERS_PER_PAGE < USERS_TO_FETCH) {
            return;
        }
        const cursorForNextPage = users[users.length - 1].id;
        setCursorHistory([...cursorHistory, cursorForNextPage]);
        fetchUsers(term, cursorForNextPage);
    };

    const pickerTitle = (
        <FormattedMessage
            id='admin.access_control.test.channel_picker.title'
            defaultMessage='Select a channel to test against'
        />
    );

    const resultsTitle = (
        <FormattedMessage
            id='admin.access_control.testResults'
            defaultMessage='Access Rule Test Results'
        />
    );

    // The back arrow appears only when the picker preceded the members list;
    // a members-only modal looks exactly as it did before this step existed.
    const modalTitle = showPicker ? pickerTitle : (
        <span className='TestResultsModal__title'>
            {requireChannel && (
                <button
                    type='button'
                    className='TestResultsModal__back'
                    onClick={handleBack}
                    aria-label={formatMessage({id: 'admin.access_control.test.channel_picker.back', defaultMessage: 'Back to channel selection'})}
                >
                    <i className='icon icon-arrow-back-ios'/>
                </button>
            )}
            {resultsTitle}
        </span>
    );

    return (
        <GenericModal
            className='TestResultsModal a11y__modal'
            id='testResultsModal'
            show={true}
            onHide={onExited}
            onExited={onExited}
            modalHeaderText={modalTitle}
            showCloseButton={true}
            bodyPadding={true}
            compassDesign={true}
            ariaLabel='Access Rule Test Results'
            isStacked={isStacked}
        >
            {showPicker ? (
                <TestChannelPicker onSelect={handleChannelSelected}/>
            ) : (
                <SearchableUserList
                    users={users}
                    usersPerPage={USERS_PER_PAGE}
                    total={total}
                    nextPage={handleNextPage}
                    search={handleSearch}
                    actionUserProps={{}}
                />
            )}
        </GenericModal>
    );
}

export default TestResultsModal;
