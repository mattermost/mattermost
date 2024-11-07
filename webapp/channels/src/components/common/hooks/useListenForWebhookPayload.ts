import { listenForIncomingWebhookPayload } from "actions/integration_actions";
import { isEmpty } from "lodash";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GlobalState } from "types/store";

export default function useListenForWebhookPayload(teamId: string) {
    const dispatch = useDispatch();
    const [status, setStatus] = useState({
        state: 'initial',
        received: false,
        payload: null,
    })

    const receivedPayload = useSelector((state:GlobalState) => state.entities.integrations.incomingWebhookPayload)
    useEffect(() => {
        if (status.state === 'initial') {
            dispatch(listenForIncomingWebhookPayload(teamId));
            setStatus({
                ...status,
                state: 'listening',
            })
        }
    }, [])

    useEffect(() => {
        if (!isEmpty(receivedPayload)) {
            setStatus({
                state: 'received',
                received: true,
                payload: receivedPayload,
            })
        }
    }, [receivedPayload])

    return status;
}