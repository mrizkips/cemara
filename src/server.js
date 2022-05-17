const Hapi = require('@hapi/hapi')
const routes = require('./routes')

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT,
        host: process.env.HOSTNAME
    })

    await server.register([
        { plugin: require('./calendar') }
    ])
    server.route(routes)

    await server.start()
    console.log(`Server running on ${server.info.uri}`)
}

init()
