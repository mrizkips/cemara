exports.plugin = {
    name: 'authentication',
    version: '1.0.0',
    once: true,
    register: async (server, options) => {
        await server.register(require('@hapi/cookie'))
        await server.register(require('@hapi/bell'))

        server.auth.strategy('session', 'cookie', {
            cookie: {
                password: '4bfsAhccZeb146bE63bcAOUFGcuzLBix',
                isSecure: process.env.NODE_ENV === 'production',
                path: '/'
            },
            validateFunc: async (request, session) => {
                const account = session

                if (!account) {
                    return { valid: false }
                }

                return { valid: true, credentials: account }
            }
        })

        server.auth.strategy('google', 'bell', {
            password: 'Bf038lxIwQ4ODJgOnrlAm2345AM9ifDy',
            provider: 'google',
            location: server.info.uri,
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
