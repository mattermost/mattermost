// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {handleYoutubeTime} from 'utils/youtube';

describe('Utils.YOUTUBE', () => {
    test('should correctly parse youtube start time formats', () => {
        for (const {link, time} of [
            {
                link: 'https://www.youtube.com/watch?time_continue=490&v=xqCoNej8Zxo',
                time: '&start=490',
            },
            {
                link: 'https://www.youtube.com/watch?start=490&v=xqCoNej8Zxo',
                time: '&start=490',
            },
            {
                link: 'https://www.youtube.com/watch?t=490&v=xqCoNej8Zxo',
                time: '&start=490',
            },
            {
                link: 'https://www.youtube.com/watch?time=490&v=xqCoNej8Zxo',
                time: '&start=490',
            },
            {
                link: 'https://www.youtube.com/watch?time=8m10s&v=xqCoNej8Zxo',
                time: '&start=490',
            },
            {
                link: 'https://www.youtube.com/watch?time=1h8m10s&v=xqCoNej8Zxo',
                time: '&start=4090',
            },
            {
                link: 'https://www.youtube.com/watch?v=xqCoNej8Zxo',
                time: '',
            },
            {
                link: 'https://www.youtube.com/watch?time=&v=xqCoNej8Zxo',
                time: '',
            },
        ]) {
            expect(handleYoutubeTime(link)).toEqual(time);
        }
    });
});
