// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';

type Props = {
    label: string;
    expanded: boolean;

    // Nesting level (0 = top level); each level adds a small left indent.
    depth?: number;
    children: React.ReactNode;
    bordered?: boolean;
};

const INDENT_PER_LEVEL_PX = 12;

// Title + caret toggle; children unmount when collapsed.
const CollapsibleSection = ({label, expanded, depth = 0, children, bordered = true}: Props) => {
    const [open, setOpen] = useState(expanded);

    // Re-sync when the form changes the expanded prop (useState only seeds it
    // on mount, and this instance is reused across form switches).
    useEffect(() => {
        setOpen(expanded);
    }, [expanded]);

    const style = depth > 0 ? {marginLeft: depth * INDENT_PER_LEVEL_PX} : undefined;

    const collapsibleSectionClass = classNames('apps-form-collapsible-section', {'apps-form-collapsible-section--bordered': bordered});

    return (
        <div
            className={collapsibleSectionClass}
            style={style}
        >
            <button
                type='button'
                className='apps-form-collapsible-section__toggle'
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
            >
                <i
                    aria-hidden='true'
                    className={open ? 'icon icon-chevron-down' : 'icon icon-chevron-right'}
                />
                <span className='apps-form-collapsible-section__title'>{label}</span>
            </button>
            {open && (
                <div className='apps-form-collapsible-section__content'>
                    {children}
                </div>
            )}
        </div>
    );
};

export default CollapsibleSection;
