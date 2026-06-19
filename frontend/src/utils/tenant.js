// src/utils/tenant.js

export const getOrCreateTenantId = () => {
    // Safety check for Server-Side Rendering (e.g., Next.js)
    if (typeof window === 'undefined') return '';

    let tenantId = localStorage.getItem('relay_tenant_id');
    
    if (!tenantId) {
        // Generate a secure, randomized UUID natively
        tenantId = self.crypto.randomUUID();
        localStorage.setItem('relay_tenant_id', tenantId);
    }
    
    return tenantId;
};