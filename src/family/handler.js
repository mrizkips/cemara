const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { nanoid } = require('nanoid')
const { FirebaseError, CalendarError } = require('../errors')
const { calendarClient } = require('./../helper')
const Joi = require('joi')

const handler = {
    insert: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        validate: {
            payload: Joi.object({
                name: Joi.string().required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const { calendar } = request.pre.calendar
            const { name } = request.payload
            const { userId } = request.auth.credentials

            const db = getFirestore()
            const userRef = db.collection('users').doc(userId)
            const user = (await userRef.get()).data()

            if (user.familyId) {
                return h.response({
                    statusCode: 400,
                    status: 'fail',
                    message: 'User sudah memiliki keluarga.'
                }).code(400)
            }

            try {
                const calendarRes = await calendar.calendars.insert({
                    requestBody: {
                        summary: name,
                        description: 'Dibuat menggunakan Cemara.'
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan data.')
                })

                const id = nanoid(16)
                const familyRef = db.collection('families').doc(id)
                const memberRef = familyRef.collection('members').doc(userId)

                const aclRes = await calendar.acl.insert({
                    calendarId: calendarRes.data.id,
                    requestBody: {
                        role: 'reader',
                        scope: {
                            type: 'user',
                            value: user.email
                        }
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan role ke calendar.')
                })

                await db.runTransaction(async (t) => {
                    t.set(familyRef, {
                        name,
                        calendarId: calendarRes.data.id
                    })

                    t.set(memberRef, {
                        role: 'owner',
                        name: user.name,
                        aclId: aclRes.data.id
                    })

                    t.update(userRef, {
                        familyId: familyRef.id
                    })
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
                if (error instanceof CalendarError) {
                    return h.response({
                        statusCode: '500',
                        status: 'fail',
                        message: `Google Calendar Error: ${error.message}`
                    }).code(500)
                } else {
                    return h.response({
                        statusCode: '500',
                        status: 'fail',
                        message: error.message
                    }).code(500)
                }
            }
        }
    },
    get: {
        auth: 'jwt_strategy',
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

            const memberRef = familyRef.collection('members')
            const snapshot = await memberRef.get()
            const members = []

            snapshot.forEach((doc) => {
                members.push({
                    id: doc.id,
                    body: doc.data()
                })
            })

            return h.response({
                statusCode: 200,
                status: 'success',
                message: 'Data keluarga ditemukan.',
                data: {
                    id: family.id,
                    body: family.data(),
                    members
                }
            })
        }
    },
    update: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        validate: {
            payload: Joi.object({
                name: Joi.string().required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const { name } = request.payload
            const { userId } = request.auth.credentials
            const { id } = request.params
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

            const familyRef = db.collection('families').doc(id)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const memberRef = familyRef.collection('members').doc(userId)
            const member = await memberRef.get()

            if (!member.exists || member.data().role !== 'owner') {
                return h.response({
                    statusCode: 403,
                    status: 'fail',
                    message: 'Tidak memiliki otoritas untuk melakukan aksi ini.'
                }).code(403)
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
    },
    delete: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const { id } = request.params
            const { userId } = request.auth.credentials
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

            const memberRef = familyRef.collection('members')
            const member = await memberRef.doc(userId).get()

            if (!member.exists || member.data().role !== 'owner') {
                return h.response({
                    statusCode: 403,
                    status: 'fail',
                    message: 'Tidak memiliki otoritas untuk melakukan aksi ini.'
                }).code(403)
            }

            const userRef = db.collection('users').doc(userId)
            const eventsRef = familyRef.collection('events')

            try {
                await calendar.calendars.delete({
                    calendarId: family.data().calendarId
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menghapus data.')
                })

                const members = []
                const memberSnapshot = await memberRef.get()
                memberSnapshot.docs.forEach((doc) => {
                    members.push(doc.ref)
                })

                const events = []
                const eventsSnapshot = await eventsRef.get()
                eventsSnapshot.docs.forEach((doc) => {
                    events.push(doc.ref)
                })

                await db.runTransaction(async (t) => {
                    t.delete(familyRef)
                    t.update(userRef, {
                        familyId: FieldValue.delete()
                    })
                    members.forEach((ref) => {
                        t.delete(ref)
                    })
                    events.forEach((ref) => {
                        t.delete(ref)
                    })
                }).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal menghapus data keluarga.')
                })

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Data keluarga berhasil dihapus.'
                }).code(200)
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
    },
    join: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        validate: {
            payload: Joi.object({
                id: Joi.string().required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const { userId } = request.auth.credentials
            const { id } = request.payload
            const db = getFirestore()

            const familyRef = db.collection('families').doc(id)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Id keluarga tidak ditemukan.'
                }).code(404)
            }

            const memberRef = family.ref.collection('members').doc(userId)
            const member = await memberRef.get()

            if (member.exists) {
                return h.response({
                    statusCode: 400,
                    status: 'fail',
                    message: 'User sudah bergabung ke dalam keluarga.'
                }).code(400)
            }

            const userRef = db.collection('users').doc(userId)
            const user = (await userRef.get()).data()

            try {
                const calendarRes = await calendar.acl.insert({
                    calendarId: family.data().calendarId,
                    requestBody: {
                        role: 'reader',
                        scope: {
                            type: 'user',
                            value: user.email
                        }
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan acl calendar.')
                })

                await db.runTransaction(async (t) => {
                    t.set(memberRef, {
                        role: 'editor',
                        name: user.name,
                        aclId: calendarRes.data.id
                    })

                    t.update(userRef, {
                        familyId: family.id
                    })
                }).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal menambahkan member.')
                })

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'User berhasil ditambahkan ke dalam keluarga.',
                    data: {
                        id: memberRef.id
                    }
                }).code(200)
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
    },
    leave: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const { userId } = request.auth.credentials
            const { id } = request.params
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

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (user.data().familyId !== family.id) {
                return h.response({
                    statusCode: 400,
                    status: 'fail',
                    message: 'Data keluarga user tidak sama dengan id.'
                }).code(400)
            }

            const memberRef = familyRef.collection('members').doc(userId)
            const member = await memberRef.get()

            if (member.data().role === 'owner') {
                const ownerQuery = await familyRef.collection('members').where('role', '==', 'owner').get()
                if (ownerQuery.docs.length <= 1) {
                    return h.response({
                        statusCode: 400,
                        status: 'fail',
                        message: 'Tetapkan role owner pada member lain terlebih dahulu.'
                    }).code(400)
                }
            }

            try {
                await calendar.acl.delete({
                    calendarId: family.data().calendarId,
                    ruleId: member.data().aclId
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menghapus acl.')
                })

                await memberRef.delete().catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal menghapus member.')
                })

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'User berhasil meninggalkan grup keluarga.'
                }).code(200)
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
    },
    role: {
        auth: 'jwt_strategy',
        validate: {
            payload: Joi.object({
                userId: Joi.string().required(),
                role: Joi.string().valid('editor', 'owner').required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const { userId } = request.auth.credentials
            const { id } = request.params
            const payload = request.payload
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

            const familyRef = db.collection('families').doc(id)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const memberRef = familyRef.collection('members').doc(userId)
            const member = await memberRef.get()

            if (!member.exists || member.data().role !== 'owner') {
                return h.response({
                    statusCode: 403,
                    status: 'fail',
                    message: 'Tidak memiliki otoritas untuk melakukan aksi ini.'
                }).code(403)
            }

            if (userId === payload.userId) {
                const ownerQuery = familyRef.collection('members').where('role', '==', 'owner')
                const snapshot = await ownerQuery.get()
                if (snapshot.docs.length <= 1) {
                    return h.response({
                        statusCode: 400,
                        status: 'fail',
                        message: 'Tetapkan role owner pada member lain terlebih dahulu.'
                    }).code(400)
                }
            }

            try {
                const updateMember = familyRef.collection('members').doc(payload.userId)
                await updateMember.update({
                    role: payload.role
                }).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal mengubah role.')
                })

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Berhasil mengubah role.',
                    data: {
                        id: updateMember.id,
                        role: payload.role
                    }
                }).code(200)
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase Error: ${error.message}`
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
