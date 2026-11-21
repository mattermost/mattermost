// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import {translateAttachments} from './attachments';

const intl = createIntl({locale: 'en'});

describe('translateAttachments', () => {
    const attachment = {
        author_name: 'Jane Doe',
        author_icon: 'https://external.example.com/author.png',
        footer: 'Footer text',
        footer_icon: 'https://external.example.com/footer.png',
        text: 'Body',
    };

    test('includes author and footer icons when blockExternalImages is off', () => {
        const blocks = translateAttachments([attachment], intl, {
            blockExternalImages: false,
            siteURL: 'https://chat.example.com',
        });

        const json = JSON.stringify(blocks);
        expect(json).toContain('https://external.example.com/author.png');
        expect(json).toContain('https://external.example.com/footer.png');
        expect(json).toContain('Jane Doe');
        expect(json).toContain('Footer text');
    });

    test('omits external author and footer icons when blockExternalImages is on while keeping text', () => {
        const blocks = translateAttachments([attachment], intl, {
            blockExternalImages: true,
            siteURL: 'https://chat.example.com',
        });

        const json = JSON.stringify(blocks);
        expect(json).not.toContain('https://external.example.com/author.png');
        expect(json).not.toContain('https://external.example.com/footer.png');
        expect(json).toContain('Jane Doe');
        expect(json).toContain('Footer text');
    });

    test('keeps internal author and footer icons when blockExternalImages is on', () => {
        const internalAttachment = {
            ...attachment,
            author_icon: 'https://chat.example.com/api/v4/files/1/preview',
            footer_icon: 'https://chat.example.com/api/v4/files/2/preview',
        };

        const blocks = translateAttachments([internalAttachment], intl, {
            blockExternalImages: true,
            siteURL: 'https://chat.example.com',
        });

        const json = JSON.stringify(blocks);
        expect(json).toContain('https://chat.example.com/api/v4/files/1/preview');
        expect(json).toContain('https://chat.example.com/api/v4/files/2/preview');
    });
});
