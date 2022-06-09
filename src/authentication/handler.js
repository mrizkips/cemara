const { OAuth2Client } = require('google-auth-library')
const { getFirestore } = require('firebase-admin/firestore')
const Joi = require('joi')
const { TokenValidationError, FirebaseError } = require('../errors')
const Jwt = require('@hapi/jwt')

const handler = {
    google: {
        auth: {
            mode: 'try',
            strategy: 'google'
        },
        handler: async function (request, h) {
            if (request.auth.isAuthenticated) {
                const response = h.response({
                    statusCode: '200',
                    status: 'success',
                    message: 'Otentikasi berhasil menggunakan akun google.',
                    data: request.auth
                }).code(200)
                return response
            }

            const response = h.response({
                statusCode: '500',
                status: 'fail',
                message: 'Otentikasi gagal. Silakan coba lagi.'
            }).code(500)
            return response
        }
    },
    login: {
        validate: {
            payload: Joi.object({
                idToken: Joi.string().required()
            })
        },
        handler: async function (request, h) {
            const { idToken } = request.payload
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

            try {
                const ticket = await client.verifyIdToken({
                    idToken,
                    audience: process.env.NODE_ENV === 'production' ? process.env.GOOGLE_MOBILE_CLIENT_ID : process.env.GOOGLE_CLIENT_ID
                }).catch((error) => {
                    console.log(error)
                    throw new TokenValidationError('ID Token tidak sesuai / ID token sudah kadaluarsa.')
                })

                const payload = ticket.getPayload()
                const db = getFirestore()
                const data = {
                    email: payload.email,
                    name: payload.name
                }

                const userRef = db.collection('users').doc(payload.sub)
                const doc = await userRef.get()
                if (!doc.exists) {
                    await userRef.set(data).then((res) => {
                        console.log('Added: ', res)
                    }).catch((error) => {
                        console.log(error)
                        throw new FirebaseError('gagal menambahkan user.')
                    })
                }

                const token = Jwt.token.generate(
                    {
                        aud: process.env.GOOGLE_CLIENT_ID,
                        iss: process.env.GOOGLE_CLIENT_ID,
                        sub: payload.sub,
                        email: payload.email,
                        name: payload.name
                    },
                    {
                        key: process.env.JWT_SECRET,
                        algorithm: 'HS512'
                    },
                    {
                        ttlSec: 60 * 60 * 24
                    }
                )

                const response = h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Login berhasil.',
                    data: {
                        idToken: token
                    }
                }).code(200)

                return response
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase error: ${error.message}`
                    }).code(500)
                } else if (error instanceof TokenValidationError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Token validation error: ${error.message}`
                    }).code(500)
                }
            }
        }
    }
}

module.exports = handler
