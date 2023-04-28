// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

export interface Item extends UserProfile {
    display_name: string;
    name: string;
    isCurrentUser: boolean;
    type: string;
    channel: Channel;
    text: string;
}
export interface SuggestionProps<T = Item> {
    term: string;
    matchedPretext: string;
    isSelection: boolean;
    onClick: (term: string, matchedPretext: string) => void;
    onMouseMove: (term: string) => void;
    item: T;
}
export type Props<P, T = Item> = P & SuggestionProps<T>
export default class Suggestion<P = unknown, T = Item> extends React.PureComponent<Props<P, T>> {
    static baseProps = {
        role: 'button',
        tabIndex: -1,
    };

    handleClick = (e: React.MouseEvent) => {
        e.preventDefault();

        this.props.onClick(this.props.term, this.props.matchedPretext);
    }

    handleMouseMove = (e: React.MouseEvent) => {
        e.preventDefault();

        this.props.onMouseMove(this.props.term);
    }
}
