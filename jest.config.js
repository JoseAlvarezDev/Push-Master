module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server.js',
        'public/**/*.js',
        '!public/service-worker.js',
        '!node_modules/**',
    ],
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
};
