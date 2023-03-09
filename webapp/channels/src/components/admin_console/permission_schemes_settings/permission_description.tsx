// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Overlay} from 'react-bootstrap';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import Tooltip from 'components/tooltip';

import {generateId} from 'utils/utils';

import {Role} from '@mattermost/types/roles';

import {AdditionalValues} from './permissions_tree/types';

type Props = {
    id: string;
    rowType: string;
    inherited?: Partial<Role>;
    selectRow: (id: string) => void;
    additionalValues?: AdditionalValues | AdditionalValues['edit_post'];
}

const PermissionDescription = (props: Props): JSX.Element => {
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
            props.selectRow(props.id);
            e.stopPropagation();
        }
    };

    const {inherited, id, rowType} = props;

    let content: string | JSX.Element = '';
    if (inherited) {
        content = (
            <span className='inherit-link-wrapper'>
                <FormattedMarkdownMessage
                    id='admin.permissions.inherited_from'
                    values={{
                        name: intl.formatMessage({
                            id: 'admin.permissions.roles.' + inherited.name + '.name',
                            defaultMessage: inherited.display_name,
                        }),
                    }}
                />
            </span>
        );
    } else {
        content = (
            <FormattedMessage
                id={'admin.permissions.' + rowType + '.' + id + '.description'}
                values={props.additionalValues}
            />
        );
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
    if (content.props.values && Object.keys(content.props.values).length > 0) {
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
