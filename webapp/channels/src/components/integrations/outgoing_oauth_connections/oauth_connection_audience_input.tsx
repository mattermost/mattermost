// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {OauthIcon, InformationOutlineIcon} from '@mattermost/compass-icons/components';

import {getOutgoingOAuthConnections as fetchOutgoingOAuthConnections} from 'mattermost-redux/actions/integrations';
import {getOutgoingOAuthConnections} from 'mattermost-redux/selectors/entities/integrations';

type Props = {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
}

const OAuthConnectionAudienceInput = (props: Props) => {
    const oauthConnections = useSelector(getOutgoingOAuthConnections);

    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(fetchOutgoingOAuthConnections());
    }, [dispatch]);

    const connections = Object.values(oauthConnections);

    const input = (
        <input
            autoComplete='off'
            id='url'
            maxLength={1024}
            className='form-control'
            value={props.value}
            onChange={props.onChange}
            placeholder={props.placeholder}
        />
    );

    if (!connections.length) {
        return input;
    }

    const matchedConnection = Object.values(oauthConnections).find((conn) => conn.audiences.find((aud) => props.value.startsWith(aud)));
    let oauthMessage: React.ReactNode;

    if (matchedConnection) {
        oauthMessage = (
            <>
                <OauthIcon
                    size={20}
                    css={{position: 'absolute', top: '45px'}}
                />
                <strong style={{position: 'absolute', top: '45px', left: '42px'}}>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.connected'
                        defaultMessage='Connected to "{connectionName}"'
                        values={{
                            connectionName: matchedConnection.name,
                        }}
                    />
                </strong>
            </>
        );
    } else {
        oauthMessage = (
            <>
                <InformationOutlineIcon
                    size={20}
                    css={{position: 'absolute', top: '45px'}}
                />
                <strong style={{position: 'absolute', top: '45px', left: '42px'}}>
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.not_connected'
                        defaultMessage='Not connected to an OAuth connection'
                    />
                </strong>
            </>
        );
    }

    return (
        <>
            {input}
            <div className='outgoing-oauth-audience-match-message'>
                {oauthMessage}
            </div>
        </>
    );
};

export default OAuthConnectionAudienceInput;
