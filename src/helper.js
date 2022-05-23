const { google } = require('googleapis')
const key = require('./../key.json')

const generateToken = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    return result
}

const initOAuth2 = (token, refreshToken) => {
    const oauth2Client = new google.auth.OAuth2(
        key.web.client_id,
        key.web.client_secret,
        key.web.redirect_uris[0]
    )

    oauth2Client.setCredentials({
        access_token: token,
        refresh_token: refreshToken
    })

    return oauth2Client
}

const initCalendarApi = (request, h) => {
    const { token, refreshToken } = request.query

    if (typeof token === 'undefined' && typeof refreshToken === 'undefined') {
        return h.response({
            status: 'fail',
            message: 'Access token atau refreshToken tidak boleh kosong.'
        }).code(400)
    }

    const oauth2Client = initOAuth2(token, refreshToken)
    const calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client
    })

    return calendar
}

const userInfo = (request, h) => {
    const { token, refreshToken } = request.query

    if (typeof token === 'undefined' && typeof refreshToken === 'undefined') {
        return h.response({
            status: 'fail',
            message: 'Access token atau refreshToken tidak boleh kosong.'
        }).code(400)
    }

    const oauth2Client = initOAuth2(token, refreshToken)
    const oauth2 = google.oauth2({
        auth: oauth2Client,
        version: 'v2'
    })

    return oauth2.userinfo.get()
}

module.exports = { generateToken, initCalendarApi, userInfo }
