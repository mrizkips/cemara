const { getAuth, GoogleAuthProvider, signInWithCredential } = require('firebase/auth')
const Joi = require('joi')
const { OAuth2Client } = require('google-auth-library')

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

                // request.cookieAuth.set(credentials)

                const response = h.response({
                    status: 'success',
                    message: 'Otentikasi berhasil menggunakan akun google.',
                    data: request.auth
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
                idToken: Joi.string().required(),
                accessToken: Joi.string().required(),
                refreshToken: Joi.string().required()
            })
        },
        handler: async function (request, h) {
            const { idToken, accessToken, refreshToken } = request.payload
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
            async function verify () {
                const ticket = await client.verifyIdToken({
                    idToken,
                    audience: process.env.GOOGLE_MOBILE_CLIENT_ID
                })
                const payload = ticket.getPayload()
                console.log(payload)
            }
            verify().catch(console.error)
            request.cookieAuth.set({ idToken, accessToken,refreshToken })

            const response = h.response({
                status: 'success',
                message: 'Login berhasil.',
                data: request.auth.credentials
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
