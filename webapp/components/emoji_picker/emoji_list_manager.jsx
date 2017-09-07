// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const OVERSCAN_COUNT = 3;

export default class EmojiListManager {
    constructor({itemCount, itemSizeGetter, itemSize}) {
        this.itemSizeGetter = itemSizeGetter;
        this.itemCount = itemCount;
        this.itemSize = itemSize;
        this.itemSizeAndPositionData = {};
        this.lastMeasuredIndex = -1;
    }

    updateConfig({itemCount, itemSize}) {
        this.itemCount = itemCount;
        this.itemSize = itemSize;
    }

    getLastMeasuredIndex() {
        return this.lastMeasuredIndex;
    }

    getSizeAndPositionForIndex(index) {
        if (index < 0 || index >= this.itemCount) {
            throw Error(`Requested index ${index} is outside of range 0..${this.itemCount}`);
        }

        if (index > this.lastMeasuredIndex) {
            const lastMeasuredSizeAndPosition = this.getSizeAndPositionOfLastMeasuredItem();
            let offset = lastMeasuredSizeAndPosition.offset + lastMeasuredSizeAndPosition.size;

            for (var i = this.lastMeasuredIndex + 1; i <= index; i++) {
                const size = this.itemSizeGetter({index: i});

                if (size == null || isNaN(size)) {
                    throw Error(`Invalid size returned for index ${i} of value ${size}`);
                }

                this.itemSizeAndPositionData[i] = {offset, size};

                offset += size;
            }

            this.lastMeasuredIndex = index;
        }

        return this.itemSizeAndPositionData[index];
    }

    getSizeAndPositionOfLastMeasuredItem() {
        return this.lastMeasuredIndex >= 0 ? this.itemSizeAndPositionData[this.lastMeasuredIndex] : {offset: 0, size: 0};
    }

    getTotalSize() {
        const lastMeasuredSizeAndPosition = this.getSizeAndPositionOfLastMeasuredItem();
        const remainSize = (this.itemCount - this.lastMeasuredIndex - 1) * this.itemSize;

        return lastMeasuredSizeAndPosition.offset + lastMeasuredSizeAndPosition.size + remainSize;
    }

    getNextStop({containerSize, offset}) {
        let nextOffset = offset;
        const totalSize = this.getTotalSize();

        if (totalSize === 0) {
            return 0;
        }

        const maxOffset = nextOffset + containerSize;
        const start = this.findNearestItem(nextOffset);
        let stop = start;

        const datum = this.getSizeAndPositionForIndex(start);
        nextOffset = datum.offset + datum.size;

        while (nextOffset < maxOffset && stop < this.itemCount - 1) {
            stop++;
            nextOffset += this.getSizeAndPositionForIndex(stop).size;
        }

        return Math.min(stop + OVERSCAN_COUNT, this.itemCount - 1);
    }

    resetItem(index) {
        this.lastMeasuredIndex = Math.min(this.lastMeasuredIndex, index - 1);
    }

    searchIndex({low, high, offset}) {
        let lowIndex = low;
        let h = high;
        const o = offset;
        let middle;
        let currentOffset;

        while (lowIndex <= h) {
            middle = lowIndex + Math.floor((h - lowIndex) / 2);
            currentOffset = this.getSizeAndPositionForIndex(middle).offset;

            if (currentOffset === o) {
                return middle;
            } else if (currentOffset < o) {
                lowIndex = middle + 1;
            } else if (currentOffset > o) {
                h = middle - 1;
            }
        }

        return lowIndex > 0 ? lowIndex - 1 : 0;
    }

    findNearestItem(offset) {
        const maxOffset = Math.max(0, offset);
        const lastMeasuredIndex = Math.max(0, this.lastMeasuredIndex);

        return this.searchIndex({
            high: lastMeasuredIndex,
            low: 0,
            offset: maxOffset
        });
    }
}
