// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef} from 'react';
import type {MouseEvent} from 'react';
import {Overlay} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Role} from '@mattermost/types/roles';

import Tooltip from 'components/tooltip';

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
        const formattedName = intl.formatMessage(rolesRolesStrings[inherited.name]);
        content = (
            <span className='inherit-link-wrapper'>
                <FormattedMessage
                    id='admin.permissions.inherited_from'
                    defaultMessage='Inherited from <link>{name}</link>.'
                    values={{
                        name: formattedName,
                        link: (text: string) => (
                            <a>{text}</a>
                        ),
                    }}
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
            <Tooltip>
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
