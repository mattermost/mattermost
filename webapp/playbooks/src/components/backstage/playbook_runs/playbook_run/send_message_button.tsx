// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUser as fetchUser} from 'mattermost-redux/actions/users';

import {ButtonIcon} from 'src/components/assets/buttons';
import {navigateToUrl} from 'src/browser_routing';

interface Props {
    userId: string;
    teamName: string | null;
}

export const SendMessageButton = (props: Props) => {
    const dispatch = useDispatch();
    const user = useSelector((state: GlobalState) => getUser(state, props.userId));

    useEffect(() => {
        if (!user) {
            dispatch(fetchUser(props.userId));
        }
    }, [props.userId]);

    const onClick = () => {
        if (!props.teamName || !user) {
            return;
        }
        navigateToUrl(`/${props.teamName}/messages/@${user.username}`);
    };

    return (
        <ButtonIcon
            style={{margin: 'auto 0'}}
            className={'icon-send'}
            onClick={onClick}
        />
    );
};
