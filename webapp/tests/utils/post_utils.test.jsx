import * as PostUtils from 'utils/post_utils.jsx';

describe('PostUtils.containsAtMention', function() {
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
                text: '@ALLISON',
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
                text: '@ALL',
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
                text: 'HEY @ALL',
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
            },
            {
                text: 'hey @ALL:+1:',
                key: '@all',
                result: true
            }
        ]) {
            const containsAtMention = PostUtils.containsAtMention(data.text, data.key);

            expect(containsAtMention).toEqual(data.result);
        }
    });
});
