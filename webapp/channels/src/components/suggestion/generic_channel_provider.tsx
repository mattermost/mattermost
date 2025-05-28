// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import {SuggestionContainer} from './suggestion';
import type {SuggestionProps} from './suggestion';

type ChannelSearchFunc = (term: string, success: (channels: Channel[]) => void, error?: (err: ServerError) => void) => (ActionResult | Promise<ActionResult | ActionResult[]>);

const GenericChannelSuggestion = React.forwardRef<HTMLLIElement, SuggestionProps<Channel>>((props, ref) => {
    const {item} = props;

    const channelName = item.display_name;
    const purpose = item.purpose;

    const icon = (
        <span className='suggestion-list__icon suggestion-list__icon--large'>
            <i className='icon icon--standard icon--no-spacing icon-globe'/>
        </span>
    );

    const description = '(~' + item.name + ')';

    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            {icon}
            <div className='suggestion-list__ellipsis'>
                <span className='suggestion-list__main'>
                    {channelName}
                </span>
                {description}
                {purpose}
            </div>
        </SuggestionContainer>
    );
});
GenericChannelSuggestion.displayName = 'GenericChannelSuggestion';

export default class GenericChannelProvider extends Provider {
    autocompleteChannels: ChannelSearchFunc;
    constructor(channelSearchFunc: ChannelSearchFunc) {
        super();

        this.autocompleteChannels = channelSearchFunc;
    }

    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<Channel>) {
        const normalizedPretext = pretext.toLowerCase();
        this.startNewRequest(normalizedPretext);

        this.autocompleteChannels(
            normalizedPretext,
            (channels: Channel[]) => {
                if (this.shouldCancelDispatch(normalizedPretext)) {
                    return;
                }

                resultsCallback({
                    matchedPretext: normalizedPretext,
                    terms: channels.map((channel: Channel) => channel.display_name),
                    items: channels,
                    component: GenericChannelSuggestion,
                });
            },
        );

        return true;
    }
}
