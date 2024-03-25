// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {OauthIcon, InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import {
    getOutgoingOAuthConnectionsForAudience as fetchOutgoingOAuthConnectionsForAudience,
    getOutgoingOAuthConnections as fetchOutgoingOAuthConnections,
} from 'mattermost-redux/actions/integrations';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getOutgoingOAuthConnections} from 'mattermost-redux/selectors/entities/integrations';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

type Props = {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
}

const OAuthConnectionAudienceInput = (props: Props) => {
    const mounted = useRef(false);
    const [matchedConnection, setMatchingOAuthConnection] = useState<OutgoingOAuthConnection | null>(null);
    const [loadingAudienceMatch, setLoadingAudienceMatch] = useState(false);

    const oauthConnections = useSelector(getOutgoingOAuthConnections);
    const oauthConnectionsEnabled = useSelector(getConfig).EnableOutgoingOAuthConnections === 'true';
    const teamId = useSelector(getCurrentTeamId);

    const dispatch = useDispatch();

    const matchConnectionsOnInput = useCallback(async (inputValue: string) => {
        const res = await dispatch(fetchOutgoingOAuthConnectionsForAudience(teamId, inputValue));
        setLoadingAudienceMatch(false);

        if (res.data && res.data.length) {
            setMatchingOAuthConnection(res.data[0]);
        } else {
            setMatchingOAuthConnection(null);
        }
    }, [dispatch, teamId]);

    const debouncedMatchConnections = useMemo(() => {
        return debounce((inputValue: string) => matchConnectionsOnInput(inputValue), 1000);
    }, [matchConnectionsOnInput]);

    useEffect(() => {
        if (mounted.current) {
            return;
        }
        mounted.current = true;

        if (oauthConnectionsEnabled) {
            dispatch(fetchOutgoingOAuthConnections(teamId));
            if (props.value) {
                setLoadingAudienceMatch(true);
                matchConnectionsOnInput(props.value);
            }
        }
    }, [oauthConnectionsEnabled, props.value, teamId, matchConnectionsOnInput, dispatch, mounted]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        props.onChange(e);

        if (oauthConnectionsEnabled) {
            setLoadingAudienceMatch(true);
            debouncedMatchConnections(e.target.value);
        }
    };

    const connections = Object.values(oauthConnections);

    const input = (
        <input
            autoComplete='off'
            id='url'
            maxLength={1024}
            className='form-control'
            value={props.value}
            onChange={onChange}
            placeholder={props.placeholder}
        />
    );

    if (!connections.length) {
        return input;
    }

    let oauthMessage: React.ReactNode;

    if (loadingAudienceMatch) {
        oauthMessage = (
            <span>
                <LoadingSpinner/>
            </span>
        );
    } else if (matchedConnection) {
        oauthMessage = (
            <>
                <span>
                    <OauthIcon
                        size={20}
                    />
                </span>
                <span className='outgoing-oauth-audience-match-message'>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.connected'
                        defaultMessage='Connected to "{connectionName}"'
                        values={{
                            connectionName: matchedConnection.name,
                        }}
                    />
                </span>
            </>
        );
    } else {
        oauthMessage = (
            <>
                <span>
                    <InformationOutlineIcon
                        size={20}
                    />
                </span>
                <span className='outgoing-oauth-audience-match-message'>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.not_connected'
                        defaultMessage='Not linked to an OAuth connection'
                    />
                </span>
            </>
        );
    }

    return (
        <>
            {input}
            <div className='outgoing-oauth-audience-match-message-container'>
                {oauthMessage}
            </div>
        </>
    );
};

export default OAuthConnectionAudienceInput;
