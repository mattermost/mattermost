import React, { useEffect, useState } from 'react';
import { IncomingWebhook } from '@mattermost/types/integrations';
import useListenForWebhookPayload from 'components/common/hooks/useListenForWebhookPayload';
import Loading_spinner from 'components/widgets/loading/loading_spinner';
import ReactJson from 'react-json-view';
import classNames from 'classnames';

import './webhook_schema_editor.scss';

type Props = {
    initialHook: IncomingWebhook;
}

type IncomingWebhookRequest = {
    text: string;
    username: string;
    icon_url: string;
    channel: string;
    props: object;
    attachments: SlackAttachment[];
    type: string;
    icon_emoji: string;
    priority?: PostPriority;
}

type SlackAttachment = {
    id: number;
    fallback: string;
    color: string;
    pretext: string;
    author_name: string;
    author_link: string;
    author_icon:
    string;
    title: string;
    title_link: string;
    text: string;
    fields: SlackAttachmentField[];
    image_url: string;
    thumb_url: string;
    footer: string;
    footer_icon: string;
    ts:
    string | number; // Timestamp can be a string or number
    // actions?: PostAction[]; 
}

type SlackAttachmentField = {
    title: string;
    value: any;
    short: boolean;
}

type PostPriority = {
    priority?: string;
    requested_ack?: boolean;
    persistent_notifications?: boolean;
    postId?: string;
    channelId?: string;
}

type Node = {
    name: string;
    namespace: string[];
    type: string;
    value: any;
}

export default function WebhookSchemaEditor({ initialHook }: Props) {
    console.log(initialHook);
    const webhookListener = useListenForWebhookPayload(initialHook.id);
    const [selectedFromNode, setSelectedFromNode] = useState<null | Node>(null);
    const [resultingSchema, setResultingSchema] = useState({
        text: '',
        username: '',
        icon_url: '',
        channel: '',
        props: {},
        attachments: [],
        type: '',
        icon_emoji: '',
        priority: {
            priority: '',
            requested_ack: false,
            persistent_notifications: false,
            postId: '',
            channelId: ''
        }
    } as IncomingWebhookRequest);
    const listenerContent = () => {
        switch (webhookListener.state) {
            case 'initial':
                return <div>Initializing...</div>;
            case 'listening':
                return (
                    <div>
                        Listening for webhook payload...
                        <Loading_spinner />
                    </div>
                );
            case 'error':
                return <div>Error receiving webhook payload.</div>;
            default:
                return <div>Unknown state.</div>;
        }
    };

    const handleSelectFrom = (select: any) => {
        console.log('from:', select);
        setSelectedFromNode(select);
    }

    const handleSelectTo = (select: any) => {
        if (!selectedFromNode || !webhookListener.payload) {
            return;
        }

        console.log('to:', select)


        const mergedJsonBase = { ...resultingSchema };

        let sourcePointer = webhookListener.payload;
        let targetPointer = mergedJsonBase;
        for (const key of selectedFromNode.namespace) {
            sourcePointer = sourcePointer[key];
        }

        const sourceValue = sourcePointer[selectedFromNode.name];

        // Traverse to the target location
        for (const key of (select as Node).namespace) {
            targetPointer = targetPointer[key];
        }

        targetPointer[select.name] = sourceValue;

        setResultingSchema(mergedJsonBase);
        setSelectedFromNode(null);
    }



    return (
        <div className="WebhookSchemaEditor">
            {listenerContent()}
            {webhookListener.received && (
                <div className="schemas-container">
                    <div className="from-schema">
                        <h2>Incoming Schema</h2>
                        <ReactJson enableClipboard={false} name={false} onSelect={handleSelectFrom} src={webhookListener.payload!} />
                    </div>
                    <div className={classNames("to-schema", Boolean(selectedFromNode) ? 'select-mode' : null)}>
                        <h2>Resulting Schema</h2>
                        <ReactJson name={false} enableClipboard={false} onSelect={handleSelectTo} src={resultingSchema} />
                    </div>
                </div>
            )}
        </div>
    );
}