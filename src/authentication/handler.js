const Joi = require('joi')
const { google } = require('googleapis')
const { initOAuth2 } = require('../helper')
const admin = require('firebase-admin')

const handler = {
    google: {
        auth: {
            mode: 'try',
            strategy: 'google'
        },
        handler: async function (request, h) {
            if (request.auth.isAuthenticated) {
                const credentials = request.auth.credentials
                request.cookieAuth.set(credentials)

                const response = h.response({
                    status: 'success',
                    message: 'Otentikasi berhasil menggunakan akun google.',
                    data: request.auth.credentials
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
                token: Joi.string().required(),
                refreshToken: Joi.string().required()
            })
        },
        handler: async function (request, h) {
            const credentials = request.payload
            request.cookieAuth.set(credentials)

            const response = h.response({
                status: 'success',
                message: 'Login berhasil.',
                data: request.auth
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
