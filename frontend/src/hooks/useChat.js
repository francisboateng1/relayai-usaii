// /client/src/hooks/useChat.js
import { useState, useRef } from 'react';
import API from '../api/client'; // Your custom Axios client

export const useChat = (scaffoldId) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const abortControllerRef = useRef(null);

    const sendMessage = async (userMessage) => {
        abortControllerRef.current = new AbortController();
        setIsGenerating(true);

        try {
            const response = await API.post(`/api/scaffolds/${scaffoldId}/chat`, 
                { userMessage },
                { signal: abortControllerRef.current.signal }
            );

            return response.data;
        } catch (err) {
            // ✅ FIX: Removed all .isCancel() checks. Using strict native error codes.
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                console.log("Network request gracefully aborted.");
            } else {
                throw err; // Only throw if it's a legitimate backend or network failure
            }
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