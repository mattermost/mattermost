// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useSyncExternalStore} from 'react';
import {FormattedMessage} from 'react-intl';

import * as Menu from 'components/menu';

import type {LogObjectWithAdditionalInfo} from './types';
import {downloadTextFile, filteredLogsFilename, logsToJsonLines} from './utils';

export type FilteredDownloadState = {

    // The entries a download would contain
    rows: LogObjectWithAdditionalInfo[];

    // Whether the rows leave out entries the server didn't send
    partial: boolean;

    // False while a reload is pending or after one failed, when the rows may be stale
    ready: boolean;
};

export type FilteredDownloadStore = ReturnType<typeof createFilteredDownloadStore>;

// On mobile the menu's children are copied into a modal when it opens, so an item can't rely on props
// to stay current. It reads from this store instead, which the list keeps up to date.
export function createFilteredDownloadStore(initial: FilteredDownloadState) {
    let state = initial;
    const listeners = new Set<() => void>();

    return {
        get: () => state,
        set: (next: FilteredDownloadState) => {
            if (next.rows === state.rows && next.partial === state.partial && next.ready === state.ready) {
                return;
            }
            state = next;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

type Props = {
    store: FilteredDownloadStore;
};

// Remember to pass all unused props into the Menu.Item, as the menu hands it the props MUI needs for a11y
const FilteredDownloadItem = forwardRef<HTMLLIElement, Props>(({store, ...otherProps}, ref) => {
    const {rows, partial, ready} = useSyncExternalStore(store.subscribe, store.get);

    // Menu.Item runs onClick once the menu has closed, so this exports the rows shown when the item was
    // activated rather than reading the store then, after a poll may have changed them.
    // MUI's disabled doesn't stop every way of activating an item, so a disabled item gets no handler
    const disabled = !ready || rows.length === 0;
    const handleClick = disabled ? undefined : () => {
        downloadTextFile(filteredLogsFilename(), logsToJsonLines(rows));
    };

    return (
        <Menu.Item
            {...otherProps}
            ref={ref}
            id='serverLogsDownloadFiltered'
            disabled={disabled}
            forceCloseOnSelect={true}
            labels={
                <>
                    <span>
                        <FormattedMessage
                            id='admin.logs.download.filtered'
                            defaultMessage='Filtered entries ({count, number})'
                            values={{count: rows.length}}
                        />
                    </span>
                    {partial && (
                        <span>
                            <FormattedMessage
                                id='admin.logs.download.filteredPartial'
                                defaultMessage='Only the loaded entries are included'
                            />
                        </span>
                    )}
                </>
            }
            onClick={handleClick}
        />
    );
});
FilteredDownloadItem.displayName = 'FilteredDownloadItem';

export default FilteredDownloadItem;
