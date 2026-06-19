// /client/src/hooks/useChat.js
import { useState, useRef } from 'react';
import API from '../api/client'; // Import your custom Axios client

export const useChat = (scaffoldId) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const abortControllerRef = useRef(null);

    const sendMessage = async (userMessage) => {
        abortControllerRef.current = new AbortController();
        setIsGenerating(true);

        try {
            // Replaced fetch with custom instance config
            const response = await API.post(`/api/scaffolds/${scaffoldId}/chat`, 
                { userMessage },
                { signal: abortControllerRef.current.signal }
            );

            // Axios puts your backend's parsed JSON output inside '.data'
            return response.data;
        } catch (err) {
            if (API.isCancel(err) || err.name === 'CanceledError') {
                console.log("User aborted");
            } else {
                throw err;
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