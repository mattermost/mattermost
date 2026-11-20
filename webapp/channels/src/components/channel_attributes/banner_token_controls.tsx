// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import * as Menu from 'components/menu';

import type {KindMessages} from 'utils/channel_kind';

import type {ChannelKind} from 'types/store/plugins';

import {attributeToken, tokenSuggestions} from './banner_template';
import UnsetValueIndicator, {unsetValueMessage} from './unset_value_indicator';

import './banner_token_controls.scss';

type Props = {

    // Every channel attribute with this channel's value, unset ones included.
    attributes: ResolvedChannelAttribute[];

    onInsertToken: (token: string) => void;

    disabled?: boolean;

    // The channel's kind, which picks the words: board rather than channel for a board.
    channelKind?: ChannelKind;
};

/**
 * The "+ Attributes" menu inside the banner text field.
 */
const BannerTokenControls = ({attributes, onInsertToken, disabled, channelKind = 'channel'}: Props) => {
    const {formatMessage} = useIntl();

    const suggestions = useMemo(() => tokenSuggestions(attributes), [attributes]);

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className='BannerTokenControls'>
            <Menu.Container
                menuButton={{
                    id: 'bannerAttributeTokenButton',
                    class: 'BannerTokenControls__button',
                    disabled,
                    children: (
                        <>
                            <PlusIcon size={14}/>
                            <FormattedMessage
                                id='channel_attributes.banner.insert_attribute'
                                defaultMessage='Attributes'
                            />
                        </>
                    ),
                    dataTestId: 'bannerAttributeTokenButton',
                    'aria-label': formatMessage({
                        id: 'channel_attributes.banner.insert_attribute_aria',
                        defaultMessage: 'Insert an attribute into the banner text',
                    }),
                }}
                menu={{
                    id: 'bannerAttributeTokenMenu',
                    'aria-label': formatMessage(messages.menuLabel[channelKind]),
                }}
            >
                {suggestions.map((suggestion) => {
                    // An unset attribute inserts a token that renders nothing, so it is
                    // flagged before the author picks it.
                    const valueStatus = suggestion.value ? formatMessage(
                        messages.valueSet[channelKind],
                        {value: suggestion.value},
                    ) : formatMessage(unsetValueMessage);

                    return (
                        <Menu.Item
                            key={suggestion.name}
                            id={`bannerAttributeToken-${suggestion.name}`}
                            data-testid={`bannerAttributeToken-${suggestion.name}`}
                            onClick={() => onInsertToken(attributeToken(suggestion.name))}

                            // One child, not two: Menu.Item reads two children as a
                            // primary and secondary label and top-aligns the row, which
                            // would lift the trailing icon off the text's centre line.
                            labels={
                                <span>
                                    <span>
                                        {suggestion.label}

                                        {/* The icon is not the only carrier of the state. The
                                            space keeps the label and status apart when read. */}
                                        <span className='sr-only'>{` ${valueStatus}`}</span>
                                    </span>
                                </span>
                            }
                            trailingElements={suggestion.value ? undefined : (
                                <UnsetValueIndicator testId={`bannerAttributeTokenUnset-${suggestion.name}`}/>
                            )}
                        />
                    );
                })}
            </Menu.Container>
        </div>
    );
};

/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
const messages = {
    menuLabel: {
        channel: defineMessage({
            id: 'channel_attributes.banner.insert_attribute_menu',
            defaultMessage: 'Channel attributes',
        }),
        board: defineMessage({
            id: 'channel_attributes.banner.insert_attribute_menu.board',
            defaultMessage: 'Board attributes',
        }),
    },
    valueSet: {
        channel: defineMessage({
            id: 'channel_attributes.banner.token_value_set',
            defaultMessage: 'Value on this channel: {value}',
        }),
        board: defineMessage({
            id: 'channel_attributes.banner.token_value_set.board',
            defaultMessage: 'Value on this board: {value}',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */

export default BannerTokenControls;
