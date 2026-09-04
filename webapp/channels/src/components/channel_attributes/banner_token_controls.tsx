// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import * as Menu from 'components/menu';

import {attributeToken, tokenSuggestions} from './banner_template';

import './banner_token_controls.scss';

type Props = {

    // Every channel attribute with this channel's value, unset ones included.
    attributes: ResolvedChannelAttribute[];

    onInsertToken: (token: string) => void;

    disabled?: boolean;
};

/**
 * The "+ Attributes" menu inside the banner text field.
 */
const BannerTokenControls = ({attributes, onInsertToken, disabled}: Props) => {
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
                        data-testid={`bannerAttributeToken-${suggestion.name}`}
                        onClick={() => onInsertToken(attributeToken(suggestion.name))}
                        labels={<span>{suggestion.label}</span>}
                    />
                ))}
            </Menu.Container>
        </div>
    );
};

export default BannerTokenControls;
