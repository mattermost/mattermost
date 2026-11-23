// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useContext, useMemo} from 'react';

import type {MmField, MmFieldsBlock} from '@mattermost/types/mm_blocks';

import ExternalLink from 'components/external_link';
import Markdown from 'components/markdown';

import {MmBlocksFieldOpenContext, MmBlocksInlineMarkdownActionsContext, MmBlocksInteractionsDisabledContext} from './context';

type FieldsBlockProps = {
    block: MmFieldsBlock;
    postId: string;
};

function externalHref(value: string) {
    if (value.startsWith('https://') || value.startsWith('http://')) {
        return value;
    }
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..')) {
        return value;
    }
    return '';
}

type FieldRow = {kind: 'pair'; left: MmField; right: MmField} | {kind: 'single'; field: MmField};

function layoutFields(fields: MmField[]): FieldRow[] {
    const rows: FieldRow[] = [];
    let pending: MmField | null = null;
    for (const field of fields) {
        if (field.short) {
            if (pending) {
                rows.push({kind: 'pair', left: pending, right: field});
                pending = null;
            } else {
                pending = field;
            }
        } else {
            if (pending) {
                rows.push({kind: 'single', field: pending});
                pending = null;
            }
            rows.push({kind: 'single', field});
        }
    }
    if (pending) {
        rows.push({kind: 'single', field: pending});
    }
    return rows;
}

function FieldValue({field, postId}: {field: MmField; postId: string}) {
    const onOpen = useContext(MmBlocksFieldOpenContext);
    const {mmBlocksActionCookie, integrationFormat} = useContext(MmBlocksInlineMarkdownActionsContext);
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    const href = field.url ? externalHref(field.url) : '';
    const toneClass = field.tone && field.tone !== 'default' ? `mm-blocks-field__value--tone-${field.tone}` : undefined;
    const valueClass = classNames('mm-blocks-field__value', toneClass);

    if (field.type_id && field.value && onOpen) {
        return (
            <button
                type='button'
                className={classNames(valueClass, 'mm-blocks-field__value--hop')}
                onClick={() => onOpen({typeId: field.type_id!, value: field.value, label: field.label})}
            >
                {field.value}
            </button>
        );
    }
    if (href) {
        return (
            <ExternalLink
                href={href}
                location='mm_blocks_field'
                className={valueClass}
            >
                {field.value || href}
            </ExternalLink>
        );
    }
    if (!field.value) {
        return null;
    }
    return (
        <span className={valueClass}>
            <Markdown
                message={field.value}
                postId={postId}
                allowInlineActions={!interactionsDisabled}
                mmBlocksActionCookie={mmBlocksActionCookie}
                integrationFormat={integrationFormat}
            />
        </span>
    );
}

function FieldCell({field, postId}: {field: MmField; postId: string}) {
    return (
        <div className='mm-blocks-field'>
            {field.label ? <div className='mm-blocks-field__label'>{field.label}</div> : null}
            {(field.value || field.url || field.type_id) ? (
                <FieldValue
                    field={field}
                    postId={postId}
                />
            ) : null}
        </div>
    );
}

export const FieldsBlock = ({block, postId}: FieldsBlockProps) => {
    const rows = useMemo(() => layoutFields(block.fields || []), [block.fields]);
    if (rows.length === 0) {
        return null;
    }
    return (
        <div
            className='mm-blocks-fields'
            role='group'
        >
            {rows.map((row, i) => {
                if (row.kind === 'pair') {
                    return (
                        <div
                            key={i}
                            className='mm-blocks-fields__row mm-blocks-fields__row--pair'
                        >
                            <FieldCell
                                field={row.left}
                                postId={postId}
                            />
                            <FieldCell
                                field={row.right}
                                postId={postId}
                            />
                        </div>
                    );
                }
                return (
                    <div
                        key={i}
                        className='mm-blocks-fields__row'
                    >
                        <FieldCell
                            field={row.field}
                            postId={postId}
                        />
                    </div>
                );
            })}
        </div>
    );
};
