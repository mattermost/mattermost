// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';

import {TopReaction} from '@mattermost/types/insights';

import RenderEmoji from 'components/emoji/render_emoji';
import SimpleTooltip from 'components/widgets/simple_tooltip';

type Props = {
    reactions: TopReaction[];
}

const TopReactionsBarChart = (props: Props) => {
    const barChartEntries = useCallback(() => {
        const reactions = props.reactions.map((reaction) => {
            const highestCount = props.reactions[0].count;
            const maxHeight = 156;

            let barHeight = (reaction.count / highestCount) * maxHeight;

            if (highestCount === reaction.count) {
                barHeight = maxHeight;
            }

            return (
                <div
                    className='bar-chart-entry'
                    key={reaction.emoji_name}
                >
                    <span className='reaction-count'>{reaction.count}</span>
                    <div
                        className='bar-chart-data'
                        style={{
                            height: `${barHeight}px`,
                        }}
                    />
                    <SimpleTooltip
                        content={reaction.emoji_name}
                        placement='bottom'
                    >
                        <span>
                            <RenderEmoji
                                emojiName={reaction.emoji_name}
                                size={20}
                            />
                        </span>
                    </SimpleTooltip>
                </div>
            );
        });

        return reactions;
    }, [props.reactions]);

    return (
        <>
            {barChartEntries()}
        </>
    );
};

export default memo(TopReactionsBarChart);
