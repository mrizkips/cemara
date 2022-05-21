const { google } = require('googleapis')
const key = require('./../../key.json')

const setCalendar = (request, h) => {
    const { token, refreshToken } = request.query

    if (typeof token === 'undefined' && typeof refreshToken === 'undefined') {
        return h.response({
            status: 'fail',
            message: 'Access token tidak boleh kosong.'
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

const handler = {
    calendar: {
        get: {
            pre: [
                { method: setCalendar, assign: 'calendarClient' }
            ],
            handler: async (request, h, err) => {
                const calendar = request.pre.calendarClient
                console.log(calendar)

                const res = await calendar.calendars.get({
                    calendarId: request.params.id ?? 'primary'
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil mengambil data calendar.',
                    items: res.data
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

                const res = await calendar.calendars.insert({
                    requestBody: {
                        summary: payload.summary
                    }
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil menambahkan calendar.',
                    items: res.data
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
                    calendarId: request.params.id ?? 'primary',
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
