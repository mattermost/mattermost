import * as PostUtils from 'utils/post_utils.jsx';

describe('PostUtils.contains', function() {
    test('should return correct @all (same for @channel)', function() {
        for (const data of [
            {
                text: undefined,    //eslint-disable-line no-undefined
                key: undefined,     //eslint-disable-line no-undefined
                result: false
            },
            {
                text: '',
                key: '',
                result: false
            },
            {
                text: 'all',
                key: '@all',
                result: false
            },
            {
                text: '@allison',
                key: '@all',
                result: false
            },
            {
                text: '@all123',
                key: '@all',
                result: false
            },
            {
                text: '123@all',
                key: '@all',
                result: false
            },
            {
                text: 'hey@all',
                key: '@all',
                result: false
            },
            {
                text: 'hey@all.com',
                key: '@all',
                result: false
            },
            {
                text: '@all',
                key: '@all',
                result: true
            },
            {
                text: '@all hey',
                key: '@all',
                result: true
            },
            {
                text: 'hey @all',
                key: '@all',
                result: true
            },
            {
                text: 'hey @all!',
                key: '@all',
                result: true
            },
            {
                text: 'hey @all:+1:',
                key: '@all',
                result: true
            }
        ]) {
            const containsAtAll = PostUtils.contains(data.text, data.key);

            expect(containsAtAll).toEqual(data.result);
        }
    });
});
