import React, { useEffect, useState } from 'react';
import { IncomingWebhook, IncomingWebhookRequest } from '@mattermost/types/integrations';
import useListenForWebhookPayload from 'components/common/hooks/useListenForWebhookPayload';
import Loading_spinner from 'components/widgets/loading/loading_spinner';
import ReactJson from 'react-json-view';
import { JsonEditor, IconCopy, NodeData, IconOk } from 'json-edit-react';
import classNames from 'classnames';

import './webhook_schema_editor.scss';
import { Button } from 'react-bootstrap';
import { Client4 } from 'mattermost-redux/client';

type Props = {
    initialHook: IncomingWebhook;
    onSchemaUpdate: (schema: IncomingWebhookRequest) => void;
}

const deepClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
}

const createEmptyIncomingWebhookRequest = (): IncomingWebhookRequest => {
    return {
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
    };
};

export default function WebhookSchemaEditor({ initialHook, onSchemaUpdate }: Props) {
    const webhookListener = useListenForWebhookPayload(initialHook.id);
    const [selectedFromNode, setSelectedFromNode] = useState<null | NodeData>(null);
    const [resultingSchema, setResultingSchema] = useState<IncomingWebhookRequest>(
        initialHook.webhook_schema_translation || createEmptyIncomingWebhookRequest()
    );




    useEffect(() => {
        onSchemaUpdate(resultingSchema);
    }, [resultingSchema]);


    const listenerContent = () => {
        switch (webhookListener.state) {
            case 'initial':
                return <div>Initializing...</div>;
            case 'listening':
                return (
                    <div>
                        Listening for webhook payload at {`http://localhost:8065/hooks/${initialHook.id}`}
                        <Loading_spinner />
                    </div>
                );
            case 'received':
                return <div>
                    <div>
                        Select values from the incoming payload, and assign them to values for your Mattermost webhook!
                    </div>
                    <div>
                        OR
                    </div>
                    <div>
                        <Button className="btn btn-primary" onClick={handleCopilotSuggestionClick}>Get Copilot Suggestion</Button>
                    </div>
                </div>
            case 'error':
                return <div>Error receiving webhook payload.</div>;
            default:
                return <div>Unknown state.</div>;
        }
    };

    const handleCopilotSuggestionClick = async () => {
        const response = await Client4.fetchWebhookSchemaSuggestionFromCopilot(webhookListener.payload!);
        console.log(response);
        setResultingSchema(JSON.parse(response));
    }

    const handleSelectFrom = (select: any, e: any) => {
        setSelectedFromNode(select);
    }

    const handleManualUpdate = (update: any) => {
        setResultingSchema(update.newData);

        return true;
    }

    const handleSelectTo = (select: any) => {
        if (!selectedFromNode || !webhookListener.payload) {
            return;
        }
        const fromPath = `$json.${selectedFromNode.path.join('.')}`;

        const mergedJsonBase = deepClone(resultingSchema);

        let targetPointer = mergedJsonBase;

        // Traverse to the target location
        const path = (select as NodeData).path;
        for (let i = 0; i < path.length - 1; i++) {
            targetPointer = targetPointer[path[i]];
        }

        if (targetPointer[path]) {
            // append to the existing value
            targetPointer[path[path.length - 1]] = targetPointer[path[path.length - 1]] + fromPath;
        } else {
            targetPointer[path[path.length - 1]] = fromPath;
        }

        setResultingSchema(mergedJsonBase);
        setSelectedFromNode(null);
    }

    const selectIcon: React.FC = () => {
        return (
            <IconCopy size={"1.4em"} />
        )
    }

    const checkIcon: React.FC = () => {
        return (
            <IconOk size={"1.4em"} />
        )
    }

    const customButtons = [
        {
            Element: selectIcon,
            onClick: (selected: NodeData, e: React.MouseEvent) => handleSelectFrom(selected, e),
        }
    ];

    const customButtonsProp = (side: string) => {
        if (side === 'from') {
            return customButtons;
        } else {
            if (selectedFromNode) {
                return [
                    {
                        Element: checkIcon,
                        onClick: (selected: NodeData, e: React.MouseEvent) => handleSelectTo(selected),
                    }
                ]
            }
            return [];
        }
    }

    return (
        <div className="WebhookSchemaEditor">
            <h1>Webhook Schema Editor</h1>
            <div className="incoming-webhook-listener">
                {listenerContent()}
            </div>
            <div className="schemas-container">
                <div className="from-schema">
                    <h2>Incoming Schema</h2>
                    {webhookListener.received && <>
                        <JsonEditor enableClipboard={false} customButtons={customButtonsProp('from')} rootName={''} restrictAdd restrictDelete restrictEdit data={webhookListener.payload!} />

                    </>
                    }
                </div>
                <div className={classNames("to-schema", Boolean(selectedFromNode) ? 'select-mode' : null)}>
                    <h2>Resulting Schema</h2>
                    <JsonEditor enableClipboard={false} onUpdate={handleManualUpdate} customButtons={customButtonsProp('to')} rootName={''} data={resultingSchema} />
                </div>
            </div>
        </div>
    );
}