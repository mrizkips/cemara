exports.plugin = {
    name: 'authentication',
    version: '1.0.0',
    once: true,
    register: async (server, options) => {
        await server.register(require('@hapi/bell'))
        await server.register(require('@hapi/jwt'))

        server.auth.strategy('jwt_strategy', 'jwt', {
            keys: process.env.JWT_SECRET,
            verify: {
                aud: process.env.GOOGLE_CLIENT_ID,
                iss: process.env.GOOGLE_CLIENT_ID,
                sub: false,
                nbf: true,
                exp: true
            },
            validate: (artifacts, request, h) => {
                return {
                    isValid: true,
                    credentials: { userId: artifacts.decoded.payload.sub }
                }
            }
        })

        server.auth.strategy('google', 'bell', {
            password: 'Bf038lxIwQ4ODJgOnrlAm2345AM9ifDy',
            provider: 'google',
            location: process.env.NODE_ENV === 'production' ? process.env.PROD_HOST : server.info.uri,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            providerParams: {
                access_type: 'offline'
            },
            scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
            isSecure: process.env.NODE_ENV === 'production'
        })

        server.route(require('./routes'))
        console.log('info', 'Plugin registered: bell authentication with strategy >>google<<')
    }
}
