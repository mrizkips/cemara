const key = require('./../../key.json')

exports.plugin = {
    name: 'authentication',
    version: '1.0.0',
    register: async (server, options) => {
        await server.register(require('@hapi/cookie'))
        await server.register(require('@hapi/bell'))

        server.auth.strategy('session', 'cookie', {
            cookie: {
                password: '4bfsAhccZeb146bE63bcAOUFGcuzLBix',
                isSecure: process.env.NODE_ENV === 'production',
                path: '/'
            }
        })

        server.auth.strategy('google', 'bell', {
            password: 'Bf038lxIwQ4ODJgOnrlAm2345AM9ifDy',
            provider: {
                name: 'google',
                protocol: 'oauth2',
                auth: key.web.auth_uri,
                token: key.web.token_uri,
                scope: ['https://www.googleapis.com/auth/calendar']
            },
            location: server.info.uri,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            providerParams: {
                access_type: 'offline'
            },
            isSecure: process.env.NODE_ENV === 'production'
        })

        server.route(require('./routes'))
        console.log('info', 'Plugin registered: bell authentication with strategy >>google<<')
    }
}
