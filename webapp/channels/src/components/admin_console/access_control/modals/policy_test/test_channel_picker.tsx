// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {searchAllChannels} from 'mattermost-redux/actions/channels';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {ChannelIcon} from 'components/channel_type_icon';
import LoadingScreen from 'components/loading_screen';

const SEARCH_DEBOUNCE_MS = 250;

// Access policies apply to public and private channels alike, and both types
// carry channel attributes a resource-aware rule reads — so search both.
// Omitting the public/private flags returns open + private; the exclusions
// mirror channel eligibility.
const CHANNEL_SEARCH_OPTS = {
    exclude_group_constrained: true,
    exclude_remote: true,
    exclude_default_channels: true,
};

interface Props {
    onSelect: (channelId: string) => void;
}

// First step of the shared test modal for a resource.attributes.* rule with no
// channel scope of its own: pick a concrete channel whose attribute values the
// rule is resolved against. Rows are icon + name + team + chevron — no member
// counts (the members step reports the matching users).
export default function TestChannelPicker({onSelect}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [term, setTerm] = useState('');
    const [channels, setChannels] = useState<ChannelWithTeamData[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Guards against a slow earlier request overwriting a newer one's results.
    const requestSeq = useRef(0);

    const search = useCallback(async (searchTerm: string) => {
        const seq = ++requestSeq.current;
        setLoading(true);
        const action = await dispatch(searchAllChannels(searchTerm, CHANNEL_SEARCH_OPTS));
        if (seq !== requestSeq.current) {
            return;
        }
        const result = action as ActionResult<ChannelWithTeamData[]>;

        // A dispatch error (e.g. network failure) must not read as an empty
        // result — otherwise the admin sees "No channels found" and assumes none
        // match rather than retrying.
        setHasError(Boolean(result.error));
        setChannels(result.data ?? []);
        setLoading(false);
    }, [dispatch]);

    useEffect(() => {
        const timer = setTimeout(() => search(term), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [term, search]);

    const placeholder = formatMessage({
        id: 'admin.access_control.test.channel_picker.search',
        defaultMessage: 'Search channels',
    });

    let listContent: JSX.Element | JSX.Element[];
    if (loading && channels.length === 0) {
        listContent = <LoadingScreen/>;
    } else if (hasError) {
        listContent = (
            <div className='TestChannelPicker__empty'>
                <FormattedMessage
                    id='admin.access_control.test.channel_picker.error'
                    defaultMessage='Could not load channels. Check your connection and try again.'
                />
            </div>
        );
    } else if (channels.length === 0) {
        listContent = (
            <div className='TestChannelPicker__empty'>
                <FormattedMessage
                    id='admin.access_control.test.channel_picker.no_results'
                    defaultMessage='No channels found'
                />
            </div>
        );
    } else {
        listContent = channels.map((channel) => (
            <button
                key={channel.id}
                type='button'
                className='TestChannelPicker__row'
                onClick={() => onSelect(channel.id)}
            >
                <ChannelIcon
                    className='TestChannelPicker__row-icon'
                    channel={channel}
                    size={18}
                />
                <span className='TestChannelPicker__row-text'>
                    <span className='TestChannelPicker__row-name'>{channel.display_name}</span>
                    {channel.team_display_name && (
                        <span className='TestChannelPicker__row-team'>{channel.team_display_name}</span>
                    )}
                </span>
                <ChevronRightIcon size={18}/>
            </button>
        ));
    }

    return (
        <div className='TestChannelPicker'>
            <div className='TestChannelPicker__search'>
                <i className='icon icon-magnify'/>
                <input
                    type='text'
                    className='TestChannelPicker__search-input'
                    placeholder={placeholder}
                    aria-label={placeholder}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                />
            </div>
            <div className='TestChannelPicker__list'>
                {listContent}
            </div>
        </div>
    );
}
