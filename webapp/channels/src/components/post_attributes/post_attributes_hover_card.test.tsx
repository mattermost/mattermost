// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FieldType, PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostAttributesHoverCard from './post_attributes_hover_card';
import type {PostAttribute} from './utils';

const GROUP_ID = 'group_id';
const CHANNEL_ID = 'channel_id';
const POST_ID = 'post_id';

const OPTIONS = [
    {id: 'opt_secret', name: 'SECRET', color: 'red'},
    {id: 'opt_noforn', name: 'NOFORN', color: 'blue'},
    {id: 'opt_surge', name: 'Surge', color: 'green'},
];

const author = TestHelper.getUserMock({
    id: 'user_alice',
    username: 'alice',
    first_name: 'Alice',
    last_name: 'Adams',
});

const baseState: DeepPartial<GlobalState> = {
    entities: {
        users: {
            profiles: {
                [author.id]: author,
            },
        },
        general: {
            config: {},
            license: {},
        },
        preferences: {
            myPreferences: {},
        },
    },
};

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: GROUP_ID,
        name: 'classification',
        type: 'select',
        object_type: 'post',
        target_type: 'channel',
        target_id: CHANNEL_ID,
        attrs: {options: OPTIONS},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'value_1',
        target_id: POST_ID,
        target_type: 'post',
        group_id: GROUP_ID,
        field_id: 'field_1',
        value: 'opt_secret',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function attribute(field: Partial<PropertyField>, value: unknown): PostAttribute {
    const built = makeField(field);
    return {field: built, value: makeValue({field_id: built.id, value})};
}

// The card's own strings, so a non-English locale does not trip react-intl's
// missing-translation error on the way to the assertion that matters.
const CARD_MESSAGES = {
    'post_attributes.card.title': 'Attributes',
    'post_attributes.card.edit': 'Edit',
};

function renderCard(
    attributes: PostAttribute[],
    onEdit: () => void = jest.fn(),
    {locale = 'en', extraMessages}: {locale?: string; extraMessages?: Record<string, string>} = {},
) {
    return renderWithContext(
        <PostAttributesHoverCard
            attributes={attributes}
            onEdit={onEdit}
        />,
        baseState,
        {locale, intlMessages: {...CARD_MESSAGES, ...extraMessages}},
    );
}

describe('PostAttributesHoverCard', () => {
    test('renders one row per attribute, in the order given', () => {
        renderCard([
            attribute({id: 'field_1', name: 'classification'}, 'opt_secret'),
            attribute({id: 'field_2', name: 'caveat'}, 'opt_noforn'),
            attribute({id: 'field_3', name: 'operation'}, 'opt_surge'),
        ]);

        const rows = screen.getAllByRole('listitem');

        expect(rows).toHaveLength(3);
        expect(rows[0]).toHaveTextContent('Classification');
        expect(rows[0]).toHaveTextContent('SECRET');
        expect(rows[1]).toHaveTextContent('caveat');
        expect(rows[1]).toHaveTextContent('NOFORN');
        expect(rows[2]).toHaveTextContent('operation');
        expect(rows[2]).toHaveTextContent('Surge');
    });

    test('prefers the display name for the row label', () => {
        renderCard([
            attribute(
                {name: 'classification', attrs: {options: OPTIONS, display_name: 'Classification level'}},
                'opt_secret',
            ),
        ]);

        expect(screen.getByText('Classification level')).toBeInTheDocument();
        expect(screen.queryByText('classification')).not.toBeInTheDocument();
    });

    test('falls back to the field name when there is no display name', () => {
        renderCard([attribute({name: 'caveat'}, 'opt_secret')]);

        expect(screen.getByText('caveat')).toBeInTheDocument();
    });

    // Classification Markings stores its unique name as a lowercase slug and
    // writes no display_name, so the shared label helper title-cases it.
    test('title-cases the classification slug, as every other attribute surface does', () => {
        renderCard([attribute({name: 'classification'}, 'opt_secret')]);

        expect(screen.getByText('Classification')).toBeInTheDocument();
        expect(screen.queryByText('classification')).not.toBeInTheDocument();
    });

    test('never runs the label through a translation lookup', () => {
        // A field an administrator named `channel` collides with a real key in
        // the catalogue. The label is user data, so it renders verbatim.
        renderCard(
            [attribute({name: 'channel'}, 'opt_secret')],
            jest.fn(),
            {extraMessages: {channel: 'Content flagged'}},
        );

        expect(screen.getByText('channel')).toBeInTheDocument();
        expect(screen.queryByText('Content flagged')).not.toBeInTheDocument();
    });

    test('shows the option name, never the stored id', () => {
        renderCard([attribute({}, 'opt_secret')]);

        expect(screen.getByText('SECRET')).toBeInTheDocument();
        expect(screen.queryByText('opt_secret')).not.toBeInTheDocument();
    });

    test('renders no value for a stored option that no longer exists', () => {
        renderCard([attribute({}, 'opt_deleted')]);

        const [row] = screen.getAllByRole('listitem');

        // The label still renders because the card is handed the attribute;
        // the value resolves to nothing, exactly as `chipCount` counts it.
        expect(row).toHaveTextContent('Classification');
        expect(row).not.toHaveTextContent('opt_deleted');
    });

    test('joins a multiselect with the locale list separator', () => {
        renderCard([
            attribute(
                {type: 'multiselect' as FieldType},
                ['opt_secret', 'opt_noforn', 'opt_surge'],
            ),
        ]);

        expect(screen.getByText('SECRET, NOFORN, and Surge')).toBeInTheDocument();
    });

    test('joins a multiselect with the Japanese separator under ja', () => {
        renderCard(
            [
                attribute(
                    {type: 'multiselect' as FieldType},
                    ['opt_secret', 'opt_noforn', 'opt_surge'],
                ),
            ],
            jest.fn(),
            {locale: 'ja'},
        );

        // U+3001. The assertion that catches a hardcoded `', '`.
        expect(screen.getByText('SECRET、NOFORN、Surge')).toBeInTheDocument();
    });

    test('renders a text value as its stored string', () => {
        renderCard([
            attribute({type: 'text' as FieldType, name: 'ticket', attrs: {}}, 'MM-12345'),
        ]);

        expect(screen.getByText('MM-12345')).toBeInTheDocument();
    });

    test('renders a user as a display name with no avatar', () => {
        const {container} = renderCard([
            attribute({type: 'user' as FieldType, name: 'reviewer', attrs: {}}, author.id),
        ]);

        expect(screen.getByText('alice')).toBeInTheDocument();
        expect(container.querySelector('.Avatar')).toBeNull();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.queryByTestId('user-property')).not.toBeInTheDocument();
    });

    test('renders values as plain text rather than chips', () => {
        renderCard([
            attribute({id: 'field_1'}, 'opt_secret'),
            attribute({id: 'field_2', type: 'text' as FieldType, attrs: {}}, 'MM-12345'),
        ]);

        // `PropertyValueRenderer` draws chips; the card must not reach for it.
        expect(screen.queryAllByTestId('select-property')).toHaveLength(0);
        expect(screen.queryAllByTestId('text-property')).toHaveLength(0);
    });

    test('calls onEdit exactly once', () => {
        const onEdit = jest.fn();

        renderCard([attribute({}, 'opt_secret')], onEdit);

        fireEvent.click(screen.getByRole('button', {name: 'Edit'}));

        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    test('carries no role, no accessible name and no aria-hidden', () => {
        const {container} = renderCard([attribute({}, 'opt_secret')]);

        const card = container.querySelector('.PostAttributesHoverCard');

        expect(card).not.toBeNull();
        expect(card).not.toHaveAttribute('role');
        expect(card).not.toHaveAttribute('aria-label');
        expect(card).not.toHaveAttribute('aria-labelledby');

        expect(card).not.toHaveAttribute('aria-hidden');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('renders an empty list rather than throwing when given no attributes', () => {
        renderCard([]);

        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
        expect(screen.getByText('Attributes')).toBeInTheDocument();
    });
});
