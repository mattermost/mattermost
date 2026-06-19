// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getPageById} from 'mattermost-redux/selectors/entities/pages';

import {submitPageComment} from 'actions/views/create_page_comment';

import {useIsMounted} from 'hooks/useIsMounted';

import type {GlobalState} from 'types/store';

type UsePageCommentSubmitResult = {
    page: ReturnType<typeof getPageById>;
    message: string;
    submitting: boolean;
    submitError: string | null;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleSubmit: () => Promise<void>;
};

export function usePageCommentSubmit(pageId: string, onSuccess?: () => void): UsePageCommentSubmitResult {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const page = useSelector((state: GlobalState) => getPageById(state, pageId));
    const isMounted = useIsMounted();

    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const submittingRef = useRef(false);

    const handleSubmit = useCallback(async () => {
        if (!message.trim() || submittingRef.current || !page) {
            return;
        }
        submittingRef.current = true;
        setSubmitting(true);
        const result = await dispatch(submitPageComment(pageId, {
            message,
            fileInfos: [],
            uploadsInProgress: [],
            channelId: '',
            rootId: pageId,
            createAt: 0,
            updateAt: 0,
        }));
        submittingRef.current = false;
        if (!isMounted()) {
            return;
        }
        setSubmitting(false);
        if (result.error) {
            setSubmitError(formatMessage({id: 'wiki_rhs.submit_error', defaultMessage: 'Failed to send reply. Please try again.'}));
        } else {
            setSubmitError(null);
            setMessage('');
            onSuccess?.();
        }
    }, [dispatch, isMounted, message, onSuccess, page, pageId]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setMessage(e.target.value), []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    return {page, message, submitting, submitError, handleChange, handleKeyDown, handleSubmit};
}
