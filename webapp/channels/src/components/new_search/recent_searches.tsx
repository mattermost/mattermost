// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState, type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {RecentSearch} from '@mattermost/types/search';
import type {Team} from '@mattermost/types/teams';

import {deleteRecentSearch, getRecentSearches as fetchRecentSearches} from 'mattermost-redux/actions/search';
import {getRecentSearches} from 'mattermost-redux/selectors/entities/search';

import {closeModal, openModal} from 'actions/views/modals';

import InfoToast from 'components/info_toast/info_toast';

import {ModalIdentifiers} from 'utils/constants';

const Container = styled.div`
    max-height: 550px;
    overflow-y: auto;
    padding: 12px 24px 20px;
`;

const Heading = styled.h2`
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
`;

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
`;

const Row = styled.li`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const RerunButton = styled.button`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border: none;
    background: transparent;
    color: var(--center-channel-color);
    text-align: left;
    cursor: pointer;

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &:focus-visible {
        outline: 2px solid var(--button-bg);
        outline-offset: 2px;
    }
`;

const ClearButton = styled.button`
    flex: 0 0 auto;
    border: none;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    padding: 4px;
    opacity: 0;
    pointer-events: none;

    ${Row}:hover &,
    ${Row}:focus-within & {
        opacity: 1;
        pointer-events: auto;
    }

    &:hover,
    &:focus-visible {
        color: var(--center-channel-color);
    }
`;

type Props = {
    onSearch: (searchType: string, searchTeam: string, searchTerms: string) => void;
    myTeams: Team[];
};

const RecentSearches = ({onSearch, myTeams}: Props): JSX.Element | null => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const items = useSelector(getRecentSearches);
    const [teamError, setTeamError] = useState('');

    useEffect(() => {
        dispatch(fetchRecentSearches());
    }, [dispatch]);

    const showTeamUnavailableToast = useCallback(() => {
        const message = intl.formatMessage({
            id: 'search_box.recent_searches.team_unavailable',
            defaultMessage: 'That team is no longer available',
        });
        setTeamError(message);
        dispatch(openModal({
            modalId: ModalIdentifiers.INFO_TOAST,
            dialogType: InfoToast,
            dialogProps: {
                content: {
                    message,
                    icon: <InformationOutlineIcon size={18}/>,
                },
                position: 'bottom-right',
                onExited: () => {
                    dispatch(closeModal(ModalIdentifiers.INFO_TOAST));
                },
            },
        }));
    }, [dispatch, intl]);

    const handleRerun = useCallback((item: RecentSearch) => {
        if (item.team_id && !myTeams.some((team) => team.id === item.team_id)) {
            showTeamUnavailableToast();
            return;
        }
        onSearch(item.search_type, item.team_id, item.terms);
    }, [myTeams, onSearch, showTeamUnavailableToast]);

    const handleClear = useCallback(async (event: React.MouseEvent, item: RecentSearch) => {
        event.stopPropagation();
        event.preventDefault();
        const result = await dispatch(deleteRecentSearch(item.id));
        if (result && 'error' in result && result.error) {
            dispatch(fetchRecentSearches());
        }
    }, [dispatch]);

    if (!items.length) {
        return null;
    }

    return (
        <Container
            data-testid='recentSearches'
            id='recentSearches'
        >
            {teamError && (
                <div
                    role='alert'
                    data-testid='recentSearchesTeamError'
                >
                    {teamError}
                </div>
            )}
            <Heading>
                <FormattedMessage
                    id='search_box.recent_searches.heading'
                    defaultMessage='Recent searches'
                />
            </Heading>
            <List>
                {items.slice(0, 5).map((item) => (
                    <Row key={item.id}>
                        <RerunButton
                            type='button'
                            id={`recentSearch_${item.id}`}
                            aria-label={intl.formatMessage(
                                {
                                    id: 'search_box.recent_searches.rerun',
                                    defaultMessage: 'Search again: {terms}',
                                },
                                {terms: item.terms},
                            )}
                            onClick={() => handleRerun(item)}
                        >
                            <i
                                className={item.search_type === 'files' ? 'icon icon-file-text-outline' : 'icon icon-message-text-outline'}
                                aria-hidden={true}
                            />
                            <span>{item.terms}</span>
                        </RerunButton>
                        <WithTooltip
                            title={intl.formatMessage({
                                id: 'search_box.recent_searches.clear',
                                defaultMessage: 'Clear',
                            })}
                        >
                            <ClearButton
                                type='button'
                                data-testid={`recentSearchClear_${item.id}`}
                                aria-label={intl.formatMessage(
                                    {
                                        id: 'search_box.recent_searches.clear_named',
                                        defaultMessage: 'Clear {terms}',
                                    },
                                    {terms: item.terms},
                                )}
                                onClick={(event) => handleClear(event, item)}
                            >
                                <i
                                    className='icon icon-close'
                                    aria-hidden={true}
                                />
                            </ClearButton>
                        </WithTooltip>
                    </Row>
                ))}
            </List>
        </Container>
    );
};

export default RecentSearches;
