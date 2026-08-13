// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import * as Menu from 'components/menu';

import {attributeToken, hasAttributeTokens, renderBannerTemplate, tokenSuggestions} from './banner_template';

import './banner_token_controls.scss';

type Props = {

    // The banner text as authored, tokens included.
    template: string;

    // Every channel attribute with this channel's value, unset ones included.
    attributes: ResolvedChannelAttribute[];

    onInsertToken: (token: string) => void;

    disabled?: boolean;
};

/**
 * The attribute-token affordances for the channel banner text: a menu that
 * inserts a token, and a preview of what the template resolves to for this
 * channel.
 *
 * Tokens are plain text in the existing textbox rather than chips inside a rich
 * editor. That keeps markdown preview, the character counter, and the length
 * validation the banner already relies on, all of which a contenteditable
 * rewrite would have to reimplement. The visual difference from the design is
 * deliberate and worth confirming.
 */
const BannerTokenControls = ({template, attributes, onInsertToken, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const suggestions = useMemo(() => tokenSuggestions(attributes), [attributes]);
    const rendered = useMemo(() => renderBannerTemplate(template, attributes), [template, attributes]);

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
                    'aria-label': formatMessage({
                        id: 'channel_attributes.banner.insert_attribute_menu',
                        defaultMessage: 'Channel attributes',
                    }),
                }}
            >
                {suggestions.map((suggestion) => (
                    <Menu.Item
                        key={suggestion.name}
                        id={`bannerAttributeToken-${suggestion.name}`}
                        onClick={() => onInsertToken(attributeToken(suggestion.name))}
                        labels={<span>{suggestion.label}</span>}
                    />
                ))}
            </Menu.Container>

            {hasAttributeTokens(template) && (
                <div
                    className='BannerTokenControls__preview'
                    data-testid='bannerAttributePreview'
                    aria-live='polite'
                >
                    <FormattedMessage
                        id='channel_attributes.banner.renders_as'
                        defaultMessage='Renders as: {text}'
                        values={{
                            text: rendered ? (
                                <span className='BannerTokenControls__previewText'>{rendered}</span>
                            ) : (

                                // A template whose attributes are all unset resolves to
                                // nothing. Saying so beats an empty line that reads as a
                                // rendering bug.
                                <span className='BannerTokenControls__previewEmpty'>
                                    <FormattedMessage
                                        id='channel_attributes.banner.renders_as_empty'
                                        defaultMessage='nothing yet — no values are set'
                                    />
                                </span>
                            ),
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default BannerTokenControls;
