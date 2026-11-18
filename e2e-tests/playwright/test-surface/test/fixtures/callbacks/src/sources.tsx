// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const SOURCES = ['ldap', 'saml'] as const;

export function Sources({linked, onPick}: {linked: string[]; onPick: (source: string) => void}) {
    // a render function passed to map by name: its parameter is the list's elements
    const renderFixed = (source: (typeof SOURCES)[number]) => (
        <button
            key={source}
            data-testid={`callbacks.fixed:${source}--button`}
            onClick={() => onPick(source)}
        />
    );

    // the same over a list computed at run time: the parameter is key data
    const renderComputed = (source: string) => (
        <button
            key={source}
            data-testid={`callbacks.computed:${source}--button`}
            onClick={() => onPick(source)}
        />
    );

    return (
        <>
            {SOURCES.map(renderFixed)}
            {linked.filter(Boolean).map(renderComputed)}
        </>
    );
}
