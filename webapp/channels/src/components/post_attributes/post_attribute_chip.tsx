// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Chip} from '@mattermost/compass-ui/components/chip';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import ChannelIcon from 'components/channel_type_icon/channel_icon';
import {useUser} from 'components/common/hooks/useUser';
import type {ChannelFieldMetadata, PostPreviewFieldMetadata, TeamFieldMetadata} from 'components/properties_card_view/properties_card_view';
import {toValueList} from 'components/properties_card_view/propertyValueRenderer/multi_value_utils';
import {textSubtype} from 'components/properties_card_view/propertyValueRenderer/renderable';
import TimestampPropertyRenderer from 'components/properties_card_view/propertyValueRenderer/timestamp_property_renderer/timestamp_property_renderer';
import UserProfileComponent from 'components/user_profile';

import Constants from 'utils/constants';
import {resolveFieldOptionChips} from 'utils/property_options';
import {imageURLForTeam, imageURLForUser} from 'utils/utils';

import {usePropertyValueMetadata} from './use_property_value_metadata';

import './post_attribute_chip.scss';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;

    // How many entries a multi-valued field may draw; the chip row's budget.
    // Undefined draws them all.
    maxItems?: number;

    // False inside another control, such as a composer chip that is itself a
    // button: the user's name is then plain text rather than the profile
    // popover's own button. Defaults to true.
    interactive?: boolean;

    // The scope of the chip's test ids: `<scope>.select--text`, `.user`, `.channel`, `.team`, `.timestamp--text`,
    // `.post_preview` and `.text--text`, as the renderers these chips replaced named them. Without a scope (the
    // composer's staged chips) the ids are the plain ones.
    testIdScope?: string;
};

/**
 * A post attribute value as Compass chips: one per option, one per user, one
 * for a text value.
 *
 * Shared by the chip row under a post and the composer's staged chips, so a
 * staged value looks like the chip it becomes. `PropertyValueRenderer` stays
 * for content flagging, which still draws the richer renderers.
 *
 * The chips are never removable here: `Chip`'s `onRemove` turns Enter and Space
 * into "remove", and the composer needs both to open a chip's value menu. The
 * test ids are the old renderers', so the chip row's tests read the same.
 */
export default function PostAttributeChip({field, value, maxItems, interactive = true, testIdScope}: Props) {
    switch (field.type) {
    case 'select':
    case 'rank':
    case 'multiselect': {
        // Capped after resolving, as the chip row's budget counted resolvable
        // options: slicing the raw value first would spend a slot on an entry
        // that draws nothing. Every option is neutral; colour is not drawn on
        // this surface.
        const chips = resolveFieldOptionChips(field, value.value);
        const shown = maxItems === undefined ? chips : chips.slice(0, Math.max(0, maxItems));

        return (
            <>
                {shown.map((chip, index) => (
                    <Chip
                        key={`${index}:${chip.key}`}
                        size='small'
                        className='PostAttributeChip'
                        data-testid={testIdScope ? `${testIdScope}.select--text` : 'select-property'}
                    >
                        {chip.label}
                    </Chip>
                ))}
            </>
        );
    }

    case 'user':
        return (
            <UserChip
                userId={typeof value.value === 'string' ? value.value : ''}
                interactive={interactive}
                testIdScope={testIdScope}
            />
        );

    // One chip per stored id, capped like `multiselect`. Indexed keys: nothing
    // stops a stored array naming the same user twice.
    case 'multiuser':
        return (
            <>
                {toValueList(value.value, maxItems).map((userId, index) => (
                    <UserChip
                        key={`${index}:${String(userId)}`}
                        userId={String(userId)}
                        interactive={interactive}
                        testIdScope={testIdScope}
                    />
                ))}
            </>
        );

    case 'text':
        return (
            <TextChip
                field={field}
                value={value}
                testIdScope={testIdScope}
            />
        );

    default:
        return null;
    }
}

/**
 * The name keeps `UserProfileComponent`, so clicking it still opens the
 * profile popover, unless the chip sits inside another control. An id whose
 * profile has not arrived renders its "Someone" fallback, as before.
 */
function UserChip({userId, interactive, testIdScope}: {userId: string; interactive: boolean; testIdScope?: string}) {
    const user = useUser(userId);

    return (
        <Chip
            size='small'
            className='PostAttributeChip'
            data-testid={testIdScope ? `${testIdScope}.user` : 'user-property'}
            leadingAvatar={user ? {src: imageURLForUser(user.id, user.last_picture_update), alt: ''} : undefined}
        >
            <UserProfileComponent
                userId={user?.id || ''}
                disablePopover={!interactive}
            />
        </Chip>
    );
}

/**
 * A text value, by subtype. A subtype that stores an id shows what the id
 * names, read from the store by `usePropertyValueMetadata`; nothing is fetched
 * per chip. Every text chip is capped at 160px; the hover card has the rest.
 */
function TextChip({field, value, testIdScope}: {field: PropertyField; value: PropertyValue<unknown>; testIdScope?: string}) {
    const metadata = usePropertyValueMetadata(field, value);
    const stored = value.value === null || value.value === undefined ? '' : String(value.value);

    switch (textSubtype(field)) {
    case 'channel': {
        const channel = (metadata as ChannelFieldMetadata | undefined)?.channel;
        const hasIcon = channel?.type === Constants.OPEN_CHANNEL || channel?.type === Constants.PRIVATE_CHANNEL;

        return (
            <Chip
                size='small'
                className='PostAttributeChip PostAttributeChip--text'
                data-testid={testIdScope ? `${testIdScope}.channel` : 'channel-property'}
                leadingIcon={hasIcon ? <ChannelIcon channel={channel}/> : undefined}
            >
                {channel ? channel.display_name : (
                    <FormattedMessage
                        id='post_card.channel_property.deleted_channel'
                        defaultMessage='Deleted channel ID: {channelId}'
                        values={{channelId: stored}}
                    />
                )}
            </Chip>
        );
    }

    case 'team': {
        const team = (metadata as TeamFieldMetadata | undefined)?.team;
        const image = team ? imageURLForTeam(team) : null;

        return (
            <Chip
                size='small'
                className='PostAttributeChip PostAttributeChip--text'
                data-testid={testIdScope ? `${testIdScope}.team` : 'team-property'}
                leadingAvatar={image ? {src: image, alt: ''} : undefined}
            >
                {team ? team.display_name : (
                    <FormattedMessage
                        id='post_card.channel_property.deleted_team'
                        defaultMessage='Deleted team ID: {teamId}'
                        values={{teamId: stored}}
                    />
                )}
            </Chip>
        );
    }

    case 'timestamp':
        return (
            <Chip
                size='small'
                className='PostAttributeChip PostAttributeChip--text'
                data-testid={testIdScope ? `${testIdScope}.timestamp--text` : 'timestamp-property'}
            >
                <TimestampPropertyRenderer value={value}/>
            </Chip>
        );

    // A whole message preview can't sit in a chip. The chip names where the
    // message is; the hover card and the modal show the rest.
    case 'post': {
        const channel = (metadata as PostPreviewFieldMetadata | undefined)?.channel;

        return (
            <Chip
                size='small'
                className='PostAttributeChip PostAttributeChip--text'
                data-testid={testIdScope ? `${testIdScope}.post_preview` : 'post-preview-property'}
            >
                {channel ? (
                    <FormattedMessage
                        id='post_attributes.chip.post_in_channel'
                        defaultMessage='Message in ~{channel}'
                        description='Text of an attribute chip under a post whose value is a link to another message. {channel} is the name of the channel that message is in.'
                        values={{channel: channel.display_name}}
                    />
                ) : (
                    <FormattedMessage
                        id='post_attributes.chip.post'
                        defaultMessage='Message'
                        description='Text of an attribute chip under a post whose value is a link to another message, when that message is not loaded. Noun.'
                    />
                )}
            </Chip>
        );
    }

    default:
        return (
            <Chip
                size='small'
                className='PostAttributeChip PostAttributeChip--text'
                data-testid={testIdScope ? `${testIdScope}.text--text` : 'text-property'}
                title={stored}
            >
                {stored}
            </Chip>
        );
    }
}
