const { getFirestore } = require('firebase-admin/firestore')
const { nanoid } = require('nanoid')
const { FirebaseError, CalendarError } = require('../errors')
const { initCalendarApi, generateToken } = require('./../helper')
const Joi = require('joi')

const handler = {
    family: {
        insert: {
            auth: 'session',
            pre: [
                { method: initCalendarApi, assign: 'calendar' }
            ],
            validate: {
                payload: Joi.object({
                    name: Joi.string().required()
                })
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const name = request.payload.name
                const userId = request.auth.credentials.userId

                const calendarRes = await calendar.calendars.insert({
                    requestBody: {
                        summary: name,
                        description: 'Dibuat menggunakan Cemara.'
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan data.')
                })

                const familyToken = generateToken(8)
                const db = getFirestore()
                const id = nanoid(16)

                const familyRef = db.collection('families').doc(id)
                const userRef = db.collection('users').doc(userId)
                const user = await userRef.get()

                try {
                    await db.runTransaction(async (t) => {
                        t.set(familyRef, {
                            id,
                            name,
                            calendarId: calendarRes.data.id,
                            token: familyToken
                        })

                        if (!user.exists) {
                            return h.response({
                                statusCode: 404,
                                status: 'fail',
                                message: 'User tidak ditemukan.'
                            }).code(404)
                        } else {
                            t.update(userRef, {
                                calendarId: calendarRes.data.id
                            })
                        }
                    })

                    return h.response({
                        statusCode: 201,
                        status: 'success',
                        message: 'Berhasil menambahkan keluarga.',
                        data: {
                            familyId: familyRef.id
                        }
                    }).code(201)
                } catch (error) {
                    await calendar.calendars.delete({
                        calendarId: calendarRes.data.id
                    })

                    if (error instanceof CalendarError) {
                        return h.response({
                            statusCode: '400',
                            status: 'fail',
                            message: `Google Calendar Error: ${error.message}`
                        }).code(400)
                    } else {
                        return h.response({
                            statusCode: '400',
                            status: 'fail',
                            message: error.message
                        }).code(400)
                    }
                }
            }
        },
        update: {
            auth: 'session',
            pre: [
                { method: initCalendarApi, assign: 'calendar' }
            ],
            validate: {
                params: Joi.object({
                    id: Joi.required()
                }),
                payload: Joi.object({
                    name: Joi.string().required()
                })
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const name = request.payload.name
                const id = request.params.id
                const db = getFirestore()

                const familyRef = db.collection('families').doc(id)
                const family = await familyRef.get()

                if (!family.exists) {
                    return h.response({
                        statusCode: 404,
                        status: 'fail',
                        message: 'Data keluarga tidak ditemukan.'
                    }).code(404)
                }

                try {
                    await familyRef.update({ name }).catch((error) => {
                        console.log(error)
                        throw new FirebaseError('gagal memperbaharui data keluarga.')
                    })

                    await calendar.calendars.update({
                        calendarId: family.data().calendarId,
                        requestBody: {
                            summary: name
                        }
                    }).catch((error) => {
                        console.log(error)
                        throw new CalendarError('gagal memperbaharui data.')
                    })

                    return h.response({
                        statusCode: 200,
                        status: 'success',
                        message: 'Data keluarga berhasil diperbaharui.',
                        data: {
                            familyId: familyRef.id,
                            name
                        }
                    }).code(200)
                } catch (error) {
                    if (error instanceof FirebaseError) {
                        return h.response({
                            statusCode: 400,
                            status: 'fail',
                            message: `Firebase Error: ${error.message}`
                        }).code(400)
                    } else if (error instanceof CalendarError) {
                        return h.response({
                            statusCode: 400,
                            status: 'fail',
                            message: `Google Calendar Error: ${error.message}`
                        }).code(400)
                    } else {
                        return h.response({
                            statusCode: 400,
                            status: 'fail',
                            message: error.message
                        }).code(400)
                    }
                }
            }
        },
        get: {
            auth: 'session',
            pre: [
                { method: initCalendarApi, assign: 'calendar' }
            ],
            validate: {
                params: Joi.object({
                    id: Joi.string().required()
                })
            },
        },
        delete: {
            auth: 'session',
            pre: [
                { method: initCalendarApi, assign: 'calendar' }
            ],
            validate: {
                params: Joi.object({
                    id: Joi.string().required()
                })
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const id = request.params.id
                const db = getFirestore()

                const familyRef = db.collection('families').doc(id)
                const family = await familyRef.get()

                if (!family.exists) {
                    return h.response({
                        statusCode: 404,
                        status: 'fail',
                        message: 'Data keluarga tidak ditemukan.'
                    }).code(404)
                }

                try {
                    await calendar.calendars.delete({
                        calendarId: id
                    }).catch((error) => {
                        console.log(error)
                        throw new CalendarError('gagal menghapus data.')
                    })

                    await familyRef.delete().catch((error) => {
                        console.log(error)
                        throw new FirebaseError('gagal menghapus data keluarga.')
                    })

                    return h.response({
                        status: 'success',
                        message: 'Data keluarga berhasil dihapus!'
                    }).code(200)
                } catch (error) {
                    if (error instanceof FirebaseError) {
                        return h.response({
                            statusCode: 400,
                            status: 'fail',
                            message: `Firebase Error: ${error.message}`
                        }).code(400)
                    } else if (error instanceof CalendarError) {
                        return h.response({
                            statusCode: 400,
                            status: 'fail',
                            message: `Google Calendar Error: ${error.message}`
                        }).code(400)
                    } else {
                        return h.response({
                            statusCode: 400,
                            status: 'fail',
                            message: error.message
                        }).code(400)
                    }
                }
            }
        }
    }
}

module.exports = handler
