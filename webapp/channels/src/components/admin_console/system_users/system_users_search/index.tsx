// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent} from 'react';
import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import Input from 'components/widgets/inputs/input/input';

import './system_users_search.scss';

type Props = {
    value?: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SystemUsersSearch(props: Props) {
    const {formatMessage} = useIntl();

    const [inputValue, setInputValue] = useState(''); // TODO add the state from redux for putting back the term when the user navigates back to the page

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const {target: {value}} = event;
        setInputValue(value);

        // TODO update the redux state for the search term but dont take that value as input value for smooth UX
    }

    function handleClear() {
        setInputValue('');
    }

    return (
        <div className='system-users__filter'>
            <Input
                type='text'
                clearable={true}
                name='searchTerm' // TODO Change after backend is updated
                containerClassName='systemUsersSearch'
                placeholder={formatMessage({id: 'admin.system_users.search.placeholder', defaultMessage: 'Search users'})}
                inputPrefix={<i className={'icon icon-magnify'}/>}
                onChange={handleChange}
                onClear={handleClear}
                value={inputValue}
            />
        </div>
    );
}

export default SystemUsersSearch;
