// Configuration for different environments
const CONFIG = {
    // Automatically detect environment and use appropriate API URL
    API_BASE_URL:
        window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : 'https://your-backend-url.vercel.app', // TODO: Replace with your actual backend URL after deployment
};

// Make CONFIG available globally
window.CONFIG = CONFIG;
