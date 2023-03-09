// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, memo, useRef} from 'react';
import {match} from 'react-router-dom';

type Props = {
    channelId: string;

    /*
     * Object from react-router
     */
    match: match<{postid: string}>;
    returnTo: string;
    teamName?: string;
    actions: {
        focusPost: (postId: string, returnTo: string, currentUserId: string) => void;
    };
    currentUserId: string;
}

const PermalinkView = (props: Props) => {
    const mounted = useRef(false);
    const [valid, setValid] = useState(false);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const doPermalinkAction = useCallback(async () => {
        const postId = props.match.params.postid;
        await props.actions.focusPost(postId, props.returnTo, props.currentUserId);
        if (mounted.current) {
            setValid(true);
        }
    }, [props.match.params.postid, props.returnTo, props.currentUserId, props.actions]);

    useEffect(() => {
        document.body.classList.add('app__body');
        doPermalinkAction();
    }, [doPermalinkAction]);

    // it is returning null because main idea of this component is to fire focusPost redux action
    if (valid && props.channelId && props.teamName) {
        return null;
    }

    return (
        <div
            id='app-content'
            className='app__content'
        />
    );
};

export default memo(PermalinkView);
