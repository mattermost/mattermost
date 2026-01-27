// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import useGetAgentsBridgeEnabled from './useGetAgentsBridgeEnabled';

/**
 * Hook to determine if vision/multimodal AI capabilities are available.
 *
 * Vision capability is determined by checking if AI agents are available.
 * Modern AI models (GPT-4, Claude, etc.) generally support vision when
 * file attachments are provided via the bridge client's FileIDs field.
 *
 * The actual vision support depends on:
 * 1. The mattermost-plugin-ai being installed and configured
 * 2. The configured AI service supporting vision (most modern LLMs do)
 *
 * If vision is not actually supported by the model, the extraction API
 * will return an appropriate error message that will be shown to the user.
 */
export default function useVisionCapability(): boolean {
    // Vision is available when agents are available
    // The actual vision capability depends on the configured AI model
    const status = useGetAgentsBridgeEnabled();
    return status.available;
}
