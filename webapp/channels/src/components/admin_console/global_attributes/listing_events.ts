// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The listing is composed server-side, so a property field websocket event only
// updates the Redux copy of one field, never the rows (applies-to, owners, source
// and name conflicts all derive from other fields). The websocket handlers call
// notifyAttributeFieldChanged so a mounted listing can refetch.
//
// Not a Redux value the listing could watch: it dispatches the fields it fetches,
// so a refetch would change that value and trigger itself.

type Listener = (groupId?: string) => void;

const listeners = new Set<Listener>();

export function subscribeToAttributeFieldChanges(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

// groupId is the changed field's group when the event identifies it. A delete
// event carries no field, so it is only known when the field was cached.
export function notifyAttributeFieldChanged(groupId?: string) {
    listeners.forEach((listener) => listener(groupId));
}
