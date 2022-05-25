const { getAuth, GoogleAuthProvider, signInWithCredential } = require('firebase/auth')
const Joi = require('joi')

const handler = {
    google: {
        auth: {
            mode: 'try',
            strategy: 'google'
        },
        handler: async function (request, h) {
            if (request.auth.isAuthenticated) {
                const credentials = request.auth.credentials
                const token = GoogleAuthProvider.credential(request.auth.artifacts.id_token)
                const res = await signInWithCredential(getAuth(), token)
                credentials.user = res.user

                request.cookieAuth.set(credentials)

                const response = h.response({
                    status: 'success',
                    message: 'Otentikasi berhasil menggunakan akun google.',
                    data: credentials
                }).code(200)
                return response
            }

            const response = h.response({
                status: 'fail',
                message: 'Otentikasi gagal. Silakan coba lagi.'
            }).code(400)
            return response
        }
    },
    login: {
        auth: {
            mode: 'try',
            strategy: 'session'
        },
        validate: {
            payload: Joi.object({
                idToken: Joi.string().required()
            })
        },
        handler: async function (request, h) {
            const { idToken } = request.payload
            const credentials = GoogleAuthProvider.credential(idToken)
            const res = await signInWithCredential(getAuth(), credentials)
            request.cookieAuth.set(res.user)

            const response = h.response({
                status: 'success',
                message: 'Login berhasil.',
                data: res.user
            }).code(200)

            return response
        }
    },
    logout: {
        auth: 'session',
        handler: async (request, h) => {
            request.cookieAuth.clear()

            const response = h.response({
                status: 'success',
                message: 'Berhasil logout'
            }).code(200)
            return response
        }
    }
}

module.exports = handler
