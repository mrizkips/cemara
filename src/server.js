const Hapi = require('@hapi/hapi')
const routes = require('./routes')
const { initializeApp } = require('firebase/app')
const admin = require('firebase-admin')
const serviceAccount = require('./../serviceAccountKey.json')
const { getAuth } = require('firebase/auth')

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT,
        host: process.env.HOSTNAME
    })

    const firebaseConfig = {
        apiKey: 'AIzaSyB2MGU0c7mKcx8LeXJEBxAEdJGFv0_AqAs',
        authDomain: 'cemaraapps.firebaseapp.com',
        databaseURL: 'https://cemaraapps-default-rtdb.firebaseio.com',
        projectId: 'cemaraapps',
        storageBucket: 'cemaraapps.appspot.com',
        messagingSenderId: '339240129870',
        appId: '1:339240129870:web:fd3a934049f47237d3fa1f',
        measurementId: 'G-8HBBZ2GB62'
    }

    const app = initializeApp(firebaseConfig)
    const auth = getAuth(app)

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://cemaraapps-default-rtdb.firebaseio.com'
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
