export const environment = {
    production: false,
    auth: {
        // Azure AD app registration (SPA) for this frontend.
        clientId: 'be29f453-6a2a-497b-a842-77ca88af2123',
        tenantId: '3d16214c-01a7-4050-836c-312b53e9be54',
        authority: 'https://login.microsoftonline.com/3d16214c-01a7-4050-836c-312b53e9be54',
        redirectUri: '/',
        postLogoutRedirectUri: '/',

        // Login scopes for the user session.
        loginScopes: ['openid', 'profile', 'email'],

        // API scopes exposed by your backend/API app registration.
        // Use a fully qualified scope: api://<API_APP_ID>/<scope_name>
        apiScopes: ['api://be29f453-6a2a-497b-a842-77ca88af2123/user_impersonation'],

        // Attach bearer token to requests that start with these paths.
        protectedResourceStartsWith: ['/api']
    }
}
