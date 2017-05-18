// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {localizeMessage} from 'utils/utils.jsx';
import {formatText} from 'utils/text_formatting.jsx';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

import React from 'react';

export default function HelpAttaching() {
    const message = [];
    message.push(localizeMessage('help.attaching.title', '# Attaching Files\n_____'));
    message.push(localizeMessage('help.attaching.methods', '## Attachment Methods\nAttach a file by drag and drop or by clicking the attachment icon in the message input box.'));
    message.push(localizeMessage('help.attaching.dragdrop', '#### Drag and Drop\nUpload a file or selection of files by dragging the files from your computer into the RHS or center pane. Dragging and dropping attaches the files to the message input box, then you can optionally type a message and press **ENTER** to post.'));
    message.push(localizeMessage('help.attaching.icon', '#### Attachment Icon\nAlternatively, upload files by clicking the grey paperclip icon inside the message input box. This opens up your system file viewer where you can navigate to the desired files and then click **Open** to upload the files to the message input box. Optionally type a message and then press **ENTER** to post.'));
    message.push(localizeMessage('help.attaching.pasting', '#### Pasting Images\nOn Chrome and Edge browsers, it is also possible to upload files by pasting them from the clipboard. This is not yet supported on other browsers.'));
    message.push(localizeMessage('help.attaching.previewer', '## File Previewer\nMattermost has a built in file previewer that is used to view media, download files and share public links. Click the thumbnail of an attached file to open it in the file previewer.'));
    message.push('\n');
    message.push(localizeMessage('help.attaching.publicLinks', '#### Sharing Public Links\nPublic links allow you to share file attachments with people outside your Mattermost team. Open the file previewer by clicking on the thumbnail of an attachment, then click **Get Public Link**. This opens a dialog box with a link to copy. When the link is shared and opened by another user, the file will automatically download.'));
    message.push(localizeMessage('help.attaching.publicLinks2', 'If **Get Public Link** is not visible in the file previewer and you prefer the feature enabled, you can request that your System Admin enable the feature from the System Console under **Security** > **Public Links**.'));
    message.push('\n');
    message.push(localizeMessage('help.attaching.downloading', '#### Downloading Files\nDownload an attached file by clicking the download icon next to the file thumbnail or by opening the file previewer and clicking **Download**.'));
    message.push(localizeMessage('help.attaching.supported', '#### Supported Media Types\nIf you are trying to preview a media type that is not supported, the file previewer will open a standard media attachment icon. Supported media formats depend heavily on your browser and operating system, but the following formats are supported by Mattermost on most browsers:'));
    message.push(localizeMessage('help.attaching.supportedList', '- Images: BMP, GIF, JPG, JPEG, PNG\n- Video: MP4\n- Audio: MP3, M4A\n- Documents: PDF'));
    message.push(localizeMessage('help.attaching.notSupported', 'Document preview (Word, Excel, PPT) is not yet supported.'));
    message.push(localizeMessage('help.attaching.limitations', '## File Size Limitations\nMattermost supports a maximum of five attached files per post, each with a maximum file size of 50Mb.'));

    return (
        <div>
            <span
                dangerouslySetInnerHTML={{__html: formatText(message.join('\n\n'))}}
            />
            <p className='links'>
                <FormattedMessage
                    id='help.learnMore'
                    defaultMessage='Learn more about:'
                />
            </p>
            <ul>
                <li>
                    <Link to='/help/messaging'>
                        <FormattedMessage
                            id='help.link.messaging'
                            defaultMessage='Basic Messaging'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/composing'>
                        <FormattedMessage
                            id='help.link.composing'
                            defaultMessage='Composing Messages and Replies'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/mentioning'>
                        <FormattedMessage
                            id='help.link.mentioning'
                            defaultMessage='Mentioning Teammates'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/formatting'>
                        <FormattedMessage
                            id='help.link.formatting'
                            defaultMessage='Formatting Messages using Markdown'
                        />
                    </Link>
                </li>
                <li>
                    <Link to='/help/commands'>
                        <FormattedMessage
                            id='help.link.commands'
                            defaultMessage='Executing Commands'
                        />
                    </Link>
                </li>
            </ul>
        </div>
    );
}
