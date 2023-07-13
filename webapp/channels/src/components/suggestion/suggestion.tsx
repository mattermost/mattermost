// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.



import React,{FormEvent} from 'react';
import { Emoji } from "@mattermost/types/emojis";

type Item = {
    emoji: Emoji;
};

type Props = {
    item: Item | string,
    term: string,
    matchedPretext: string,
    isSelection?: boolean,
    onClick?: (term:string,matchedPretext:string) => void,
    onMouseMove?: (term:string) => void,
};

export default class Suggestion extends React.Component<Props> {

    static baseProps = {
        role: 'button',
        tabIndex: -1,
    };

    handleClick = (e:FormEvent) => {
        e.preventDefault();
        if (this.props.onClick) {
            this.props.onClick(this.props.term, this.props.matchedPretext);
        }
    };

    handleMouseMove = (e:FormEvent) => {
        e.preventDefault();
        if(this.props.onMouseMove){
            this.props.onMouseMove(this.props.term);
        }
    };
}
