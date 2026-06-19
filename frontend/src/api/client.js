// src/api/client.js
import axios from 'axios';
import { getOrCreateTenantId } from '../utils/tenant';

const API = axios.create({
   baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// The interceptor catches every outgoing request and injects the footprint
API.interceptors.request.use(
    (config) => {
        const tenantId = getOrCreateTenantId();
        if (tenantId) {
            config.headers['X-Tenant-ID'] = tenantId;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default API;