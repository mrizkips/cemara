exports.plugin = {
    name: 'profile',
    version: '1.0.0',
    register: async (server, options) => {
        await server.register(require('../authentication'))

        server.route(require('./routes'))
        console.log('info', 'Plugin registered: google client plugin')
    }
}
