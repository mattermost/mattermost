// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

type Props = {
    label: string;
    expanded: boolean;

    // Nesting level (0 = top level); each level adds a small left indent.
    depth?: number;
    children: React.ReactNode;
};

const INDENT_PER_LEVEL_PX = 12;

// Title + caret toggle; children unmount when collapsed.
const CollapsibleSection = ({label, expanded, depth = 0, children}: Props) => {
    const [open, setOpen] = useState(expanded);

    const style = depth > 0 ? {marginLeft: depth * INDENT_PER_LEVEL_PX} : undefined;

    return (
        <div
            className='apps-form-collapsible-section'
            style={style}
        >
            <button
                type='button'
                className='apps-form-collapsible-section__toggle'
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
            >
                <i className={open ? 'icon icon-chevron-down' : 'icon icon-chevron-right'}/>
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
