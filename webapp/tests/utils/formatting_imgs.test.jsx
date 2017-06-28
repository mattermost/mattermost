// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';

import * as Markdown from 'utils/markdown.jsx';

describe('Markdown.Imgs', function() {
    it('Inline mage', function(done) {
        assert.equal(
            Markdown.format('![Mattermost](/images/icon.png)').trim(),
            '<p><img src="/images/icon.png" alt="Mattermost" class="markdown-inline-img"></p>'
        );

        done();
    });

    it('Image with hover text', function(done) {
        assert.equal(
            Markdown.format('![Mattermost](/images/icon.png "Mattermost Icon")').trim(),
            '<p><img src="/images/icon.png" alt="Mattermost" title="Mattermost Icon" class="markdown-inline-img"></p>'
        );

        done();
    });

    it('Image with link', function(done) {
        assert.equal(
            Markdown.format('[![Mattermost](../../images/icon-76x76.png)](https://github.com/mattermost/platform)').trim(),
            '<p><a class="theme markdown__link" href="https://github.com/mattermost/platform" rel="noreferrer" target="_blank"><img src="../../images/icon-76x76.png" alt="Mattermost" class="markdown-inline-img"></a></p>'
        );

        done();
    });

    it('Image with width and height', function(done) {
        assert.equal(
            Markdown.format('![Mattermost](../../images/icon-76x76.png =50x76 "Mattermost Icon")').trim(),
            '<p><img src="../../images/icon-76x76.png" alt="Mattermost" title="Mattermost Icon" width="50" height="76" class="markdown-inline-img"></p>'
        );

        done();
    });

    it('Image with width', function(done) {
        assert.equal(
            Markdown.format('![Mattermost](../../images/icon-76x76.png =50 "Mattermost Icon")').trim(),
            '<p><img src="../../images/icon-76x76.png" alt="Mattermost" title="Mattermost Icon" width="50" class="markdown-inline-img"></p>'
        );

        done();
    });
});
