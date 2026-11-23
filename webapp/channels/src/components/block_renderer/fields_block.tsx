// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useContext, useMemo} from 'react';

import type {MmField, MmFieldsBlock} from '@mattermost/types/mm_blocks';

import ExternalLink from 'components/external_link';

import {MmBlocksFieldOpenContext} from './context';

type FieldsBlockProps = {
    block: MmFieldsBlock;
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

function FieldValue({field}: {field: MmField}) {
    const onOpen = useContext(MmBlocksFieldOpenContext);
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
    return <span className={valueClass}>{field.value}</span>;
}

function FieldCell({field}: {field: MmField}) {
    return (
        <div className='mm-blocks-field'>
            {field.label ? <div className='mm-blocks-field__label'>{field.label}</div> : null}
            {(field.value || field.url || field.type_id) ? <FieldValue field={field}/> : null}
        </div>
    );
}

export const FieldsBlock = ({block}: FieldsBlockProps) => {
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
                            <FieldCell field={row.left}/>
                            <FieldCell field={row.right}/>
                        </div>
                    );
                }
                return (
                    <div
                        key={i}
                        className='mm-blocks-fields__row'
                    >
                        <FieldCell field={row.field}/>
                    </div>
                );
            })}
        </div>
    );
};
