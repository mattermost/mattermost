// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useState} from 'react';
import {useSelector} from 'react-redux';

import type {AIGeneratedProfile} from '@mattermost/types/users';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

export type AITheme = {
    theme: Theme;
    explanation: string;
    generated_at: number;
};

export type UseAIThemeReturn = {
    aiTheme: AITheme | null;
    loading: boolean;
    generating: boolean;
    error: string | null;
    successMessage: string | null;
    themePreference: 'light' | 'dark' | 'auto';
    setThemePreference: (preference: 'light' | 'dark' | 'auto') => void;
    generateAITheme: () => Promise<void>;
    clearMessages: () => void;
};

const useAITheme = (): UseAIThemeReturn => {
    const currentUserId = useSelector(getCurrentUserId);
    
    const [aiTheme, setAiTheme] = useState<AITheme | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'auto'>('auto');

    const generateAITheme = useCallback(async () => {
        if (!currentUserId) {
            setError('User not found');
            return;
        }

        setGenerating(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // First, get the user's AI profile
            const profile: AIGeneratedProfile = await Client4.getUserProfile(currentUserId);
            
            if (!profile) {
                setError('No AI profile found. Please generate your AI profile first.');
                return;
            }

            // Generate AI theme based on the profile
            const result = await Client4.generateAITheme(currentUserId, {
                writing_style_report: profile.writing_style_report,
                topics: profile.topics,
                theme_preference: themePreference,
            });

            setAiTheme(result);
            setSuccessMessage('AI theme generated successfully!');
            
            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err?.message || 'Failed to generate AI theme. Please try again.');
        } finally {
            setGenerating(false);
        }
    }, [currentUserId]);

    const clearMessages = useCallback(() => {
        setError(null);
        setSuccessMessage(null);
    }, []);

    return {
        aiTheme,
        loading,
        generating,
        error,
        successMessage,
        themePreference,
        setThemePreference,
        generateAITheme,
        clearMessages,
    };
};

export default useAITheme;
