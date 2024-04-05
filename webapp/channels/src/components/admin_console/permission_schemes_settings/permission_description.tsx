// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef} from 'react';
import type {MouseEvent} from 'react';
import {Overlay} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import type {Role} from '@mattermost/types/roles';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import Tooltip from 'components/tooltip';

import {generateId} from 'utils/utils';

import type {AdditionalValues} from './permissions_tree/types';
import {rolesRolesStrings} from './strings/roles';

type Props = {
    id: string;
    inherited?: Partial<Role>;
    selectRow: (id: string) => void;
    additionalValues?: AdditionalValues | AdditionalValues['edit_post'];
    description: string | JSX.Element;
}

const PermissionDescription = ({
    id,
    selectRow,
    description,
    additionalValues,
    inherited,
}: Props): JSX.Element => {
    const [open, setOpen] = useState(false);
    const randomId = generateId();
    const contentRef = useRef<HTMLSpanElement>(null);
    const intl = useIntl();

    const closeTooltip = () => setOpen(false);

    const openTooltip = (e: MouseEvent) => {
        const elm = e.currentTarget.querySelector('span');
        const isElipsis = elm ? elm.offsetWidth < elm.scrollWidth : false;
        setOpen(isElipsis);
    };

    const parentPermissionClicked = (e: MouseEvent) => {
        const parent = (e.target as HTMLSpanElement).parentElement;
        const isInheritLink = parent?.parentElement?.className === 'inherit-link-wrapper';
        if (parent?.className !== 'permission-description' && !isInheritLink) {
            e.stopPropagation();
        } else if (isInheritLink) {
            selectRow(id);
            e.stopPropagation();
        }
    };

    let content: string | JSX.Element = '';
    if (inherited && inherited.name) {
        content = (
            <span className='inherit-link-wrapper'>
                <FormattedMarkdownMessage
                    id='admin.permissions.inherited_from'
                    defaultMessage='Inherited from [{name}]().'
                    values={{name: intl.formatMessage(rolesRolesStrings[inherited.name])}}
                />
            </span>
        );
    } else {
        content = description;
    }
    let tooltip: JSX.Element | null = (
        <Overlay
            show={open}
            placement='top'
            target={(contentRef.current as HTMLSpanElement)}
        >
            <Tooltip id={randomId}>
                {content}
            </Tooltip>
        </Overlay>
    );
    if (!inherited && additionalValues) {
        tooltip = null;
    }
    content = (
        <span
            className='permission-description'
            onClick={parentPermissionClicked}
            ref={contentRef}
            onMouseOver={openTooltip}
            onMouseOut={closeTooltip}
        >
            {content}
            {tooltip}
        </span>
    );

    return content;
};

export default PermissionDescription;
