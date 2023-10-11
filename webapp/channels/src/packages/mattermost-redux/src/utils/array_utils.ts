// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// insertWithoutDuplicates inserts an item into an array and returns the result. The provided array is not modified.
// If the array already contains the given item, that item is moved to the new location instead of adding a duplicate.
// If the array already had the given item at the given index, the origianl array is returned.
export function insertWithoutDuplicates<T>(array: T[], item: T, newIndex: number) {
    const index = array.indexOf(item);
    if (newIndex === index) {
        // The item doesn't need to be moved since its location hasn't changed
        return array;
    }

    const newArray = [...array];

    // Remove the item from its old location if it already exists in the array
    if (index !== -1) {
        newArray.splice(index, 1);
    }

    // And re-add it in its new location
    newArray.splice(newIndex, 0, item);

    return newArray;
}

export function insertMultipleWithoutDuplicates<T>(array: T[], items: T[], newIndex: number) {
    let newArray = [...array];

    items.forEach((item) => {
        newArray = removeItem(newArray, item);
    });

    // And re-add it in its new location
    newArray.splice(newIndex, 0, ...items);

    return newArray;
}

// removeItem removes an item from an array and returns the result. The provided array is not modified. If the array
// did not originally contain the given item, the original array is returned.
export function removeItem<T>(array: T[], item: T) {
    const index = array.indexOf(item);
    if (index === -1) {
        return array;
    }

    const result = [...array];
    result.splice(index, 1);
    return result;
}
