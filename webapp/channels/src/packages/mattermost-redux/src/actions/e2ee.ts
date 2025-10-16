import { Client4 } from "mattermost-redux/client";
import { E2EEPreKeyBundleResponse, E2EERegisterDeviceResponse, E2EEReplenishOPKsRequest, E2EERotateSPKRequest } from "@mattermost/types/e2ee";
import { E2EEService } from "e2ee/service/E2EEService";
import { getCurrentUserId } from "mattermost-redux/selectors/entities/common";
import { ActionFuncAsync } from "mattermost-redux/types/actions";
import { forceLogoutIfNecessary } from "./helpers";
import { ServerError } from "@mattermost/types/errors";
import { logError } from "./errors";
import { EncryptedMessage, SenderKeyDistributionMessage, SenderKeyService } from "e2ee/service/SenderKeyService";
import { getChannelMembers } from "./channels";
import { Post } from "@mattermost/types/posts";
import { MessageStore } from "e2ee/storage/MessageStore";
import { getPostById, savePost } from "e2ee/service/MessageService";

const td = new TextDecoder();

let serviceByUser: Map<string, E2EEService> = new Map();
let senderServiceByUser: Map<string, SenderKeyService> = new Map();

function getService(userId: string): E2EEService {
    let svc = serviceByUser.get(userId);
    if (!svc) {
       svc = new E2EEService(userId);
       serviceByUser.set(userId, svc);
    }
    return svc;
};

function getSenderService(userId: string, deviceId: number): SenderKeyService {
    let svc = senderServiceByUser.get(userId);
    if (!svc) {
        svc = new SenderKeyService(userId, deviceId);
        senderServiceByUser.set(userId, svc);
    }
    return svc;
}

export function registerDevice(): ActionFuncAsync<E2EERegisterDeviceResponse | null> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);

        const deviceId = await svc.store.getDeviceId();
        if (deviceId !== undefined) {
            return {data: null};
        }

        try {
            const registerPayload = await svc.installDevice(100);
            const res = await Client4.registerE2EEDevice(registerPayload);
            await svc.store.saveDeviceId(res.device_id);
            return {res};
        } catch(error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }
    }
}

export function rotateSPK(): ActionFuncAsync<boolean> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);

        const deviceId = await svc.store.getDeviceId();
        const spkId = await svc.store.getCurSignedPreKeyId();
        if (spkId !== undefined) {
            const spk = await svc.store.loadSignedPreKey(spkId);
            // TODO: Rotate by Date
            if (spk !== undefined) {
                return {data: true};
            }
        }

        try {
            const rotateSPKPayload = await svc.rotateSignedPreKey();
            const rotateSPKRequest: E2EERotateSPKRequest = {
                device_id: deviceId!,
                signed_prekey: rotateSPKPayload
            };
            await Client4.rotateSignedPreKey(rotateSPKRequest);
            return {data: true};
        } catch(error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }
    }
}

export function replenishOPKs(): ActionFuncAsync<{saved: number}> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);

        const opks = await svc.store.getAll('prekey-store');
        if (opks.length >= 100) {
            return {saved: 0};
        }

        try {
            const deviceId = await svc.store.getDeviceId();
            const replenishOPKsPayload = await svc.replenishOneTimePreKeys(100);
            const replenishOPKsRequest: E2EEReplenishOPKsRequest = {
                device_id: deviceId!,
                one_time_prekeys: replenishOPKsPayload
            };
            const data = await Client4.replenishOneTimePreKeys(replenishOPKsRequest);
            return {data};
        } catch(error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }
    }
}

export interface OneToOneEnvelope {
    toUserId: string;
    toDeviceId: number;
    type: number;
    body_b64: string;
};

export function ensureSenderKeyForChannel(channelId: string): ActionFuncAsync<OneToOneEnvelope[]> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);
        const deviceId = await svc.store.getDeviceId();
        const sendersvc = getSenderService(userId, deviceId!);

        try {
            const senderState = await sendersvc.loadSenderState(channelId);
            const channelState = await svc.store.getChannelState(channelId);
            const out = channelState.outMember;
            const newMembers = channelState.newMembers;

            if (senderState.length !== 0 && !out && newMembers.length === 0) return {data: []};

            let envelope: OneToOneEnvelope[] = [];

            const senderKeyMessage = await sendersvc.createOrRotateSenderKey(channelId);
            const payload = new TextEncoder().encode(JSON.stringify(senderKeyMessage)).buffer;

            if (out || senderState.length !== 0) {
                const channelUsers = await dispatch(getChannelMembers(channelId));
                if (!channelUsers.data) return {data: []};
                for (const user of channelUsers.data) {
                    if (user.user_id === userId) continue;
                    const {data, error} = await dispatch(buildSessionWithUser(channelId, user.user_id));
                    if (error || !data) {
                        console.log(error);
                        throw new Error(`Failed to create session with ${user.user_id}`);
                    }

                    for (const bundle of data.bundles) {
                        const {type, body} = await svc.encryptForPeer(user.user_id, bundle.device_id, payload);
                        envelope.push({
                            toUserId: user.user_id,
                            toDeviceId: bundle.device_id,
                            type,
                            body_b64: btoa(body)
                        });
                    }
                }
            } else if(newMembers.length > 0) {
                for (const user of newMembers) {
                    if (user === userId) continue;
                    const {data, error} = await dispatch(buildSessionWithUser(channelId, user));
                    if (error || !data) {
                        console.log(error);
                        throw new Error(`Failed to create session with ${user}}`);
                    }

                    for (const bundle of data.bundles) {
                        const {type, body} = await svc.encryptForPeer(user, bundle.device_id, payload);
                        envelope.push({
                            toUserId: user,
                            toDeviceId: bundle.device_id,
                            type,
                            body_b64: btoa(body)
                        });
                    }
                    await svc.store.addChannelMember(channelId, user, data.devices_count, data.device_list_hash);
                }
            }
            await svc.store.updateChannelState(channelId, [], false);
            return {data: envelope};
        } catch(error) {
            return {error};
        }
    }
}

export function decryptSenderKeyMessage(post: Post): ActionFuncAsync<boolean> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);
        const savedPost = await getPostById(userId, post.id);
        if (savedPost !== undefined) {
            return {data: true};
        }
        const deviceId = await svc.store.getDeviceId();
        const sendersvc = getSenderService(userId, deviceId!);

        const envelopes = post.props.envelope as OneToOneEnvelope[];
        const env = envelopes.find(e => e.toUserId === userId && e.toDeviceId === deviceId);

        if (!env) return {data: false};
        const from = post.props.from as {userId: string, deviceId: number};

        const pt = await svc.decryptFromPeer(
            from.userId,
            from.deviceId,
            { type: env.type, body: atob(env.body_b64)}
        );
        const plaintext = td.decode(pt);
        const skm: SenderKeyDistributionMessage = JSON.parse(plaintext);
        await sendersvc.importSenderKeyDistribution(skm);

        return {data: true};
    }
}

export function buildSessionWithUser(channelId: string, recipientUserId: string): ActionFuncAsync<E2EEPreKeyBundleResponse> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);

        try {
            const data: E2EEPreKeyBundleResponse = await Client4.getPreKeyBundle(recipientUserId);
            const bundles = data.bundles;

            for (const bundle of bundles) {
                await svc.ensureSessionWithPeer(recipientUserId, bundle.device_id, {
                    registrationId: bundle.registration_id,
                    identityPubKeyB64: bundle.identity_key_public,
                    signedPreKey: {
                        keyId: bundle.signed_prekey.key_id,
                        publicKeyB64: bundle.signed_prekey.public_key,
                        signatureB64: bundle.signed_prekey.signature,
                    },
                    oneTimePreKey: bundle.one_time_prekey ? {keyId: bundle.one_time_prekey.key_id, publicKeyB64: bundle.one_time_prekey.public_key} : null,
                });
            }

            return {data};
        } catch(error) {
            dispatch(logError(error as ServerError));
            return {error};
        }
    }
}

export function encryptPostMessage(post: Post): ActionFuncAsync<Post> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);
        const deviceId = await svc.store.getDeviceId();
        const sendersvc = getSenderService(userId, deviceId!);

        try {
            const enc = await sendersvc.encryptGroupMessage(post.channel_id, post.message);
            const encryptedPost: Post = {
                ...post,
                message: enc.ct_b64,
                props: {
                    ...(post.props || {}),
                    from: {userId: enc.senderUserId, deviceId: enc.senderDeviceId},
                    epoch: enc.epoch,
                    msgIndex: enc.msgIndex,
                    iv_b64: enc.iv_b64,
                    mac_b64: enc.mac_b64,
                    sig_b64: enc.sig_b64,
                }
            };
            return {data: encryptedPost};
        } catch(error) {
            return {error};
        }
    }
}

export function decryptPostMessage(post: Post): ActionFuncAsync<Post> {
    return async(dispatch, getState) => {
        const userId = getCurrentUserId(getState());
        const svc = getService(userId);
        const deviceId = await svc.store.getDeviceId();
        const sendersvc = getSenderService(userId, deviceId!);

        if (post.type !== "") {
            const savedPost = await getPostById(userId, post.id);
            if (savedPost !== undefined) return {data: post};
            if (post.type === 'system_add_to_channel') {
                await svc.store.newChannelMember(post.channel_id, post.props['addedUserId'] as string);
            }
            else if (post.type === 'system_join_channel') {
                await svc.store.newChannelMember(post.channel_id, post.user_id);
            }
            else if (post.type === 'system_remove_from_channel') {
                await svc.store.removeChannelMember(post.channel_id, post.props['removedUserId'] as string);
            }
            if (post.type === 'system_leave_channel') {
                await svc.store.removeChannelMember(post.channel_id, post.user_id);
            }
            
            await savePost(userId, post);
            return {data: post};
        }

        try {
            const savedPost = await getPostById(userId, post.id);
            if (savedPost !== undefined) {
                let changed = false;
                if (savedPost.reply_count !== post.reply_count) {
                    savedPost.reply_count = post.reply_count;
                    changed = true;
                }
                if (savedPost.last_reply_at != post.last_reply_at) {
                    savedPost.last_reply_at = post.last_reply_at;
                    changed = true;
                }
                if (savedPost.is_pinned !== post.is_pinned) {
                    savedPost.is_pinned = post.is_pinned;
                    changed = true;
                }
                if (savedPost.participants !== post.participants) {
                    savedPost.participants = post.participants;
                    changed = true;
                }
                if (Object.hasOwn(post as any, 'has_reactions')) {
                    const newVal = Boolean((post as any)['has_reactions']);
                    if ((savedPost as any)['has_reactions'] !== newVal) {
                        (savedPost as any)['has_reactions'] = newVal;
                        changed = true;
                    }
                } else if (Object.hasOwn(savePost as any, 'has_reactions')) {
                    delete (savedPost as any)['has_reactions'];
                    changed = true;
                }

                if(savedPost.metadata !== post.metadata) {
                    savedPost.metadata = post.metadata;
                    changed = true;
                }
                if (changed) await savePost(userId, savedPost);
                return {data: savedPost};
            }
            const from = post.props.from as {userId: string, deviceId: number};
            if (userId === from.userId && deviceId === from.deviceId) {
                return {data: post};
            }
            const enc: EncryptedMessage = {
                channelId: post.channel_id,
                senderUserId: from.userId,
                senderDeviceId: from.deviceId,
                epoch: post.props.epoch as number,
                msgIndex: post.props.msgIndex as number,
                ct_b64: post.message,
                iv_b64: post.props.iv_b64 as string,
                mac_b64: post.props.mac_b64 as string,
                sig_b64: post.props.sig_b64 as string,
            };

            const ptBytes = await sendersvc.decryptGroupMessage(enc);
            const plaintext = new TextDecoder().decode(ptBytes);
            const decryptedPost: Post = {
                ...post,
                message: plaintext,
                props: {
                    ...(post.props || {}),
                }
            };
            await savePost(userId, decryptedPost);
            return {data: decryptedPost};  
        } catch(error) {
            return {error};
        }
    }
}
