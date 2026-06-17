// /client/src/hooks/useChat.js
import { useState, useRef } from 'react';

export const useChat = (scaffoldId) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const abortControllerRef = useRef(null);

    const sendMessage = async (userMessage) => {
        abortControllerRef.current = new AbortController();
        setIsGenerating(true);

        try {
            const response = await fetch(`/api/scaffolds/${scaffoldId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) throw new Error("Request failed");
            const data = await response.json();
            return data;
        } catch (err) {
            if (err.name === 'AbortError') console.log("User aborted");
            throw err;
        } finally {
            setIsGenerating(false);
        }
    };

    const stop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsGenerating(false);
        }
    };

    return { sendMessage, stop, isGenerating };
};