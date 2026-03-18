// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import HelpLinks from './help_links';
import useHelpPageTitle from './use_help_page_title';

import './help.scss';

const title = defineMessage({id: 'help.attaching.title', defaultMessage: 'Attaching Files'});

const HelpAttaching = (): JSX.Element => {
    useHelpPageTitle(title);

    return (
        <div className='Help'>
            <div className='Help__header'>
                <h1>
                    <FormattedMessage
                        id='help.attaching.title'
                        defaultMessage='Attaching Files'
                    />
                </h1>
            </div>

            <div className='Help__content'>
                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.attaching.methods.title'
                            defaultMessage='Attachment Methods'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.attaching.methods.description'
                            defaultMessage='There are three ways to attach a file. You can drag and drop files, use the <b>Attachment</b> icon, or copy and paste files.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>

                    <h3>
                        <FormattedMessage
                            id='help.attaching.drag.title'
                            defaultMessage='Drag and Drop Files'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.attaching.drag.description'
                            defaultMessage='Upload a file, or a selection of files, by dragging the files from your computer into the right-hand sidebar or center pane. Dragging and dropping attaches the files to the message input box, then you can optionally type a message and press ENTER to post the message.'
                        />
                    </p>

                    <h3>
                        <FormattedMessage
                            id='help.attaching.icon.title'
                            defaultMessage='Use the Attachment Icon'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.attaching.icon.description'
                            defaultMessage='Alternatively, upload files by selecting the <b>Attachment</b> icon inside the message input box. In the system file viewer, navigate to the desired files, then select <b>Open</b> to upload them to the message input box. Optionally type a message, then press <b>ENTER</b> to post the message.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>

                    <h3>
                        <FormattedMessage
                            id='help.attaching.paste.title'
                            defaultMessage='Copy and Paste Files'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.attaching.paste.description'
                            defaultMessage='On Chrome and Edge browsers, you can upload files by pasting them from the system clipboard. This is not yet supported on other browsers.'
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.attaching.previewer.title'
                            defaultMessage='File Previewer'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.attaching.previewer.description'
                            defaultMessage='Mattermost has a built-in file previewer used to view media, download files, and to share public links. Select the thumbnail of an attached file to open it in the file previewer.'
                        />
                    </p>

                    <h3>
                        <FormattedMessage
                            id='help.attaching.public.title'
                            defaultMessage='Share Public Links'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.attaching.public.description'
                            defaultMessage='Public links enable you to share file attachments with people outside your Mattermost team. Open the file previewer by selecting the thumbnail of an attachment, then select <b>Get a public link</b>. Copy the link provided. When the link is shared and opened by another user, the file automatically downloads.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='help.attaching.public.note'
                            defaultMessage='If the <b>Get a public link</b> option is not visible in the file previewer, and you want this feature enabled, ask your System Admin to enable this feature in the System Console under <b>Site Configuration > Public Links</b>.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>

                    <h3>
                        <FormattedMessage
                            id='help.attaching.download.title'
                            defaultMessage='Download Files'
                        />
                    </h3>
                    <p>
                        <FormattedMessage
                            id='help.attaching.download.description'
                            defaultMessage='Download an attached file by selecting the Download icon next to the file thumbnail, or by opening the file previewer and selecting <b>Download</b>.'
                            values={{
                                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.attaching.supported.title'
                            defaultMessage='Supported Media Types for Previews'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.attaching.supported.description'
                            defaultMessage='If you are trying to preview a media type that is not supported, the file previewer opens a standard media attachment icon. Supported media formats depend heavily on your browser and operating system. The following formats are supported by Mattermost on most browsers:'
                        />
                    </p>
                    <ul>
                        <li>
                            <FormattedMessage
                                id='help.attaching.supported.images'
                                defaultMessage='Images: BMP, GIF, JPG, JPEG, PNG, SVG'
                            />
                        </li>
                        <li>
                            <FormattedMessage
                                id='help.attaching.supported.video'
                                defaultMessage='Video: MP4'
                            />
                        </li>
                        <li>
                            <FormattedMessage
                                id='help.attaching.supported.audio'
                                defaultMessage='Audio: MP3, M4A'
                            />
                        </li>
                        <li>
                            <FormattedMessage
                                id='help.attaching.supported.documents'
                                defaultMessage='Documents: PDF, TXT'
                            />
                        </li>
                    </ul>
                    <p>
                        <FormattedMessage
                            id='help.attaching.supported.note'
                            defaultMessage='Other document formats (such as Word, Excel, or PPT) are not yet supported.'
                        />
                    </p>
                </section>

                <section className='Help__section'>
                    <h2>
                        <FormattedMessage
                            id='help.attaching.size.title'
                            defaultMessage='File Size Limitations'
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            id='help.attaching.size.description'
                            defaultMessage='Mattermost supports up to ten files attached per post. The default maximum file size is 100 MB (megabytes), but this can be changed by your System Admin. Image files can be a maximum size of 7680 pixels x 4320 pixels, with a maximum image resolution of 33 MP (mega pixels) or 8K resolution, and a maximum raw image file size of approximately 253 MB.'
                        />
                    </p>
                </section>

                <HelpLinks excludePage='attaching'/>
            </div>
        </div>
    );
};

export default HelpAttaching;

