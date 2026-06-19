// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {ServerError} from '@mattermost/types/errors';
import type {Wiki, WikiLink} from '@mattermost/types/wikis';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {closeModal} from 'actions/views/modals';
import {fetchTeamWikis, fetchWikiLinksForChannel, linkWikiToChannel} from 'actions/wiki_actions';

import {useIsMounted} from 'hooks/useIsMounted';
import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channelId: string;
    onExited: () => void;
};

function LinkWikiModal({
    channelId,
    onExited,
}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [selectedWikiId, setSelectedWikiId] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableWikis, setAvailableWikis] = useState<Wiki[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useIsMounted();

    const currentTeamId = useSelector(getCurrentTeamId);

    useEffect(() => {
        let cancelled = false;
        const fetchWikis = async () => {
            if (!currentTeamId) {
                if (!cancelled) {
                    setAvailableWikis([]);
                    setIsLoading(false);
                }
                return;
            }

            if (!cancelled) {
                setIsLoading(true);
                setError(null);
            }
            let wikisResult;
            let linksResult;
            try {
                [wikisResult, linksResult] = await Promise.all([
                    dispatch(fetchTeamWikis(currentTeamId)),
                    dispatch(fetchWikiLinksForChannel(channelId)),
                ]);
            } catch {
                if (!cancelled) {
                    setError(formatMessage({
                        id: 'link_wiki.fetch_error',
                        defaultMessage: 'Failed to load wikis.',
                    }));
                    setIsLoading(false);
                }
                return;
            }
            if (cancelled) {
                return;
            }
            if (('error' in wikisResult && wikisResult.error) ||
                ('error' in linksResult && linksResult.error)) {
                setError(formatMessage({
                    id: 'link_wiki.fetch_error',
                    defaultMessage: 'Failed to load wikis.',
                }));
                setIsLoading(false);
                return;
            }
            const wikis = 'data' in wikisResult && wikisResult.data ? wikisResult.data : [];
            const freshLinks = ('data' in linksResult && linksResult.data) ? linksResult.data : [];
            const linkedWikiIds = new Set(freshLinks.map((l: WikiLink) => l.wiki_id));
            const unlinked = wikis.filter((w: Wiki) => !linkedWikiIds.has(w.id));
            setAvailableWikis(unlinked);
            setIsLoading(false);
        };

        fetchWikis();
        return () => {
            cancelled = true;
        };

        // formatMessage is intentionally omitted: it only changes on locale reload
        // and re-fetching wikis on locale change is unnecessary.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, currentTeamId, dispatch]);

    const handleCancel = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.WIKI_LINK));
    }, [dispatch]);

    const handleWikiSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedWikiId(e.target.value);
    }, []);

    const isBusy = isLinking || isLoading;

    const handleConfirm = useCallback(async () => {
        if (!selectedWikiId || isBusy) {
            return;
        }

        setIsLinking(true);
        setError(null);
        try {
            const result = await dispatch(linkWikiToChannel(channelId, selectedWikiId));
            if (!isMounted()) {
                return;
            }
            if ('error' in result && result.error) {
                const err = result.error as ServerError;
                if (err.status_code === 409) {
                    setError(formatMessage({
                        id: 'link_wiki.already_linked',
                        defaultMessage: 'This wiki is already linked to this channel.',
                    }));
                } else if (err.status_code === 403) {
                    setError(formatMessage({
                        id: 'link_wiki.no_permission',
                        defaultMessage: 'You don\'t have permission to link wikis to this channel.',
                    }));
                } else {
                    setError(formatMessage({
                        id: 'link_wiki.error',
                        defaultMessage: 'Failed to link wiki. Please try again.',
                    }));
                }
                setIsLinking(false);
                return;
            }
            setIsLinking(false);
            dispatch(closeModal(ModalIdentifiers.WIKI_LINK));
        } catch {
            if (!isMounted()) {
                return;
            }
            setIsLinking(false);
            setError(formatMessage({
                id: 'link_wiki.error',
                defaultMessage: 'Failed to link wiki. Please try again.',
            }));
        }
    }, [selectedWikiId, isBusy, channelId, dispatch, formatMessage]);

    const title = formatMessage({
        id: 'link_wiki.title',
        defaultMessage: 'Link a wiki to this channel',
    });

    const confirmButtonText = formatMessage({
        id: 'link_wiki.confirm',
        defaultMessage: 'Link wiki',
    });

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            isConfirmDisabled={!selectedWikiId || isBusy}
            autoCloseOnConfirmButton={false}
        >
            <p>
                {formatMessage({
                    id: 'link_wiki.description',
                    defaultMessage: 'Select an existing wiki to link to this channel. Linked wikis appear as tabs.',
                })}
            </p>
            <div
                role='status'
                aria-live='polite'
                className='sr-only'
            >
                {isLoading ? formatMessage({id: 'link_wiki.loading', defaultMessage: 'Loading wikis...'}) : ''}
            </div>
            <div className='form-group'>
                <label htmlFor='wiki-select'>
                    {formatMessage({
                        id: 'link_wiki.wiki_label',
                        defaultMessage: 'Wiki',
                    })}
                </label>
                <select
                    id='wiki-select'
                    className='form-control'
                    value={selectedWikiId}
                    onChange={handleWikiSelect}
                    disabled={isBusy}
                >
                    <option value=''>
                        {isLoading ? formatMessage({id: 'link_wiki.loading', defaultMessage: 'Loading wikis...'}) : formatMessage({id: 'link_wiki.select_wiki', defaultMessage: 'Select a wiki...'})}
                    </option>
                    {availableWikis.map((wiki) => (
                        <option
                            key={wiki.id}
                            value={wiki.id}
                        >
                            {wiki.title}
                        </option>
                    ))}
                </select>
            </div>
            {!isLoading && availableWikis.length === 0 && !error && (
                <p className='help-text'>
                    {formatMessage({
                        id: 'link_wiki.no_wikis',
                        defaultMessage: 'No wikis available to link. Either no wikis exist in this team, or all wikis are already linked to this channel.',
                    })}
                </p>
            )}
            {error && (
                <div
                    className='alert alert-danger'
                    role='alert'
                >
                    {error}
                </div>
            )}
        </GenericModal>
    );
}

export default LinkWikiModal;
