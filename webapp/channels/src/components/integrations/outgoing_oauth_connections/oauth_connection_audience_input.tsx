// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {OauthIcon} from '@mattermost/compass-icons/components';

import {getOutgoingOAuthConnections as fetchOutgoingOAuthConnections} from 'mattermost-redux/actions/integrations';
import {getOutgoingOAuthConnections} from 'mattermost-redux/selectors/entities/integrations';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

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
    }, []);

    const matchedConnection = Object.values(oauthConnections).find((conn) => conn.audiences.find((aud) => props.value.startsWith(aud)));
    let oauthIcon: React.ReactNode | undefined;
    if (matchedConnection) {
        oauthIcon = (
            <OverlayTrigger overlay={<Tooltip id='matched-oauth-connection'>{`Connected to"${matchedConnection.name}"`}</Tooltip>}>
                <OauthIcon
                    title={matchedConnection.name}
                    size={28}
                    css={{
                        position: 'absolute',
                        right: '-16px',
                        top: '4px',
                    }}
                />
            </OverlayTrigger>
        );
    }

    return (
        <>
            <input
                autoComplete='off'
                id='url'
                type='text'
                maxLength={1024}
                className='form-control'
                value={props.value}
                onChange={props.onChange}
                placeholder={props.placeholder}
            />
            {oauthIcon}
        </>
    );
};

export default OAuthConnectionAudienceInput;
