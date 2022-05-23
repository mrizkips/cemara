const Hapi = require('@hapi/hapi')
const routes = require('./routes')
const admin = require('firebase-admin')
const serviceAccount = require('./../serviceAccountKey.json')

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT,
        host: process.env.HOSTNAME
    })

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    })

    await server.register([
        { plugin: require('./calendar') },
        { plugin: require('./family') }
    ])
    server.route(routes)

    await server.start()
    console.log(`Server running on ${server.info.uri}`)
}

init()
