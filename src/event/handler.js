const { getFirestore } = require('firebase-admin/firestore')
const Joi = require('joi')
const { nanoid } = require('nanoid')
const { FirebaseError, CalendarError } = require('../errors')
const { calendarClient } = require('../helper')

const handler = {
    get: {
        auth: 'session',
        handler: async (request, h) => {
            const { userId } = request.auth.credentials
            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (typeof user.data().familyId === 'undefined') {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak memiliki data keluarga.'
                }).code(404)
            }

            const familyRef = db.collection('families').doc(user.data().familyId)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const eventRef = familyRef.collection('events')
            const eventSnapshot = await eventRef.get()
            const events = []

            eventSnapshot.forEach((doc) => {
                events.push({
                    id: doc.id,
                    body: doc.data()
                })
            })

            const memberRef = familyRef.collection('members')
            const memberSnapshot = await memberRef.get()
            const members = []

            memberSnapshot.forEach((doc) => {
                members.push({
                    id: doc.id,
                    role: doc.data().role
                })
            })

            const data = family.data()
            data.id = family.id
            data.members = members
            data.events = events

            return h.response({
                statusCode: 200,
                status: 'success',
                message: 'Berhasil mengambil data event.',
                data
            })
        }
    },
    insert: {
        auth: 'session',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        validate: {
            payload: Joi.object({
                start: Joi.date().iso().less(Joi.ref('end')).required(),
                end: Joi.date().iso().required(),
                summary: Joi.string().required(),
                description: Joi.string().required(),
                userId: Joi.string().required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const payload = request.payload
            const { userId } = request.auth.credentials

            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (typeof user.data().familyId === 'undefined') {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak memiliki data keluarga.'
                }).code(404)
            }

            const familyRef = db.collection('families').doc(user.data().familyId)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            try {
                const responsible = (await familyRef.collection('members').doc(payload.userId).get()).data()

                const calendarRes = await calendar.events.insert({
                    calendarId: family.data().calendarId,
                    requestBody: {
                        start: {
                            dateTime: new Date(payload.start).toISOString()
                        },
                        end: {
                            dateTime: new Date(payload.end).toISOString()
                        },
                        summary: payload.summary,
                        description: `<strong>${responsible.name}</strong><p>${payload.description}</p>`
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan event.')
                })

                console.log(calendarRes.data)

                const id = nanoid(16)
                const eventRef = familyRef.collection('events').doc(id).set({
                    creator: userId,
                    start: new Date(payload.start).toISOString(),
                    end: new Date(payload.end).toISOString(),
                    summary: payload.summary,
                    description: payload.description,
                    assignFor: payload.userId
                }).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal menambahkan event.')
                })

                return h.response({
                    statusCode: 201,
                    status: 'success',
                    message: 'Berhasil menambahkan event.',
                    data: eventRef.data()
                }).code(201)
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase Error: ${error.message}`
                    }).code(500)
                } else if (error instanceof CalendarError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Google Calendar Error: ${error.message}`
                    }).code(500)
                } else {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: error.message
                    }).code(500)
                }
            }
        }
    }
}

module.exports = handler
