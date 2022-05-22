const { google } = require('googleapis')
const key = require('./../../key.json')
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')

const setCalendar = (request, h) => {
    const { token, refreshToken } = request.query

    if (typeof token === 'undefined' && typeof refreshToken === 'undefined') {
        return h.response({
            status: 'fail',
            message: 'Access token atau refreshToken tidak boleh kosong.'
        }).code(400)
    }

    const oauth2Client = new google.auth.OAuth2(
        key.web.client_id,
        key.web.client_secret,
        key.web.redirect_uris[0]
    )

    oauth2Client.setCredentials({
        access_token: token,
        refresh_token: refreshToken
    })

    const calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client
    })

    return calendar
}

const generateToken = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    return result
}

const handler = {
    calendar: {
        get: {
            pre: [
                { method: setCalendar, assign: 'calendarClient' }
            ],
            handler: async (request, h, err) => {
                const calendar = request.pre.calendarClient

                const res = await calendar.calendars.get({
                    calendarId: request.query.calendarId ?? 'primary'
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil mengambil data calendar.',
                    data: res.data
                }).code(200)
            }
        },
        insert: {
            pre: [
                { method: setCalendar, assign: 'calendarClient' }
            ],
            handler: async (request, h, err) => {
                const calendar = request.pre.calendarClient
                const payload = request.payload

                const calendarRes = await calendar.calendars.insert({
                    requestBody: {
                        summary: payload.summary,
                        description: 'Dibuat menggunakan Cemara.'
                    }
                })

                const familyToken = generateToken(8)
                const db = getFirestore()

                const newFamily = db.collection('families').doc()
                const dbRes = await newFamily.set({
                    name: payload.summary,
                    gcalendarId: calendarRes.data.id,
                    token: familyToken
                })

                console.log(newFamily)

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil menambahkan calendar.',
                    data: dbRes
                })
            }
        },
        delete: {
            pre: [
                { method: setCalendar, assign: 'calendarClient' }
            ],
            handler: async (request, h, err) => {
                const calendar = request.pre.calendarClient
                const payload = request.payload

                const calendarRes = await calendar.calendars.delete({
                    requestBody: {
                        calendarId: payload.calendarId
                    }
                })
            }
        }
    },
    event: {
        list: {
            pre: [
                { method: setCalendar, assign: 'calendarClient' }
            ],
            handler: async (request, h, err) => {
                const calendar = request.pre.calendarClient

                const res = await calendar.events.list({
                    calendarId: request.query.calendarId ?? 'primary',
                    timeMin: (new Date()).toISOString(),
                    maxResults: 5
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil mengambil data events.',
                    data: res.data
                })
            }
        }
    }
}

module.exports = handler
