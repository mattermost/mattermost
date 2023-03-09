// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';

export function getCustomEmoji() {
    const customEmoji = `emoji${getRandomId()}`;

    return {
        customEmoji,
        customEmojiWithColons: `:${customEmoji}:`,
    };
}

export function verifyLastPostedEmoji(emojiName, emojiImageFile) {
    cy.getLastPost().find('p').find('span > span').then((imageSpan) => {
        cy.expect(imageSpan.attr('title')).to.equal(emojiName);

        // # Filter out the url from the css background property
        // url("https://imageurl") => https://imageurl
        const url = imageSpan.css('background-image').split('"')[1];

        // * Verify that the emoji image is the correct one
        cy.fixture(emojiImageFile).then((overrideImage) => {
            cy.request({url, encoding: 'base64'}).then((response) => {
                expect(response.status).to.equal(200);
                expect(response.body).to.eq(overrideImage);
            });
        });
    });
}
