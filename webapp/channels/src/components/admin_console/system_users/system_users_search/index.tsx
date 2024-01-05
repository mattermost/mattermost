// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {ChangeEvent} from 'react';
import React, {useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';

import Constants from 'utils/constants';

type Props = {
    value?: string;
    onChange: ({searchTerm, teamId, filter}: {searchTerm?: string; teamId?: string; filter?: string}) => void;
    onSearch: (value: string) => void;
};

// Repurpose for the new search

function SystemUsersSearch(props: Props) {
    const {formatMessage} = useIntl();

    const debouncedSearch = useCallback(debounce((value: string) => {
        props.onSearch(value);
    }, Constants.SEARCH_TIMEOUT_MILLISECONDS), []);

    useEffect(() => {
        return () => {
            debouncedSearch.cancel();
        };
    }, []);

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const searchTerm = e?.target?.value?.trim() ?? '';
        props.onChange({searchTerm});

        if (searchTerm.length > 0) {
            debouncedSearch(searchTerm);
        }
    }

    return (
        <div className='system-users__filter'>
            <input
                id='searchUsers'
                className='form-control filter-textbox'
                placeholder={formatMessage({
                    id: 'filtered_user_list.search',
                    defaultMessage: 'Search users',
                })}
                value={props.value}
                onChange={handleChange}
            />
        </div>
    );
}

export default SystemUsersSearch;
