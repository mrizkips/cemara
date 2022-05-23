const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')
const { nanoid } = require('nanoid')
const helper = require('./../helper')

const handler = {
    family: {
        insert: {
            pre: [
                { method: helper.initCalendarApi, assign: 'calendar' }
            ],
            handler: async (request, h, err) => {
                const calendar = request.pre.calendar
                const user = request.pre.user
                const payload = request.payload

                const calendarRes = await calendar.calendars.insert({
                    requestBody: {
                        summary: payload.summary,
                        description: 'Dibuat menggunakan Cemara.'
                    }
                })

                console.log(calendarRes)

                const familyToken = helper.generateToken(8)
                const db = getFirestore()

                const newFamily = await db.collection('families').add({
                    id: nanoid(16),
                    name: payload.summary,
                    calendarId: calendarRes.data.id,
                    token: familyToken
                })

                // try {
                //     await db.runTransaction(async (t) => {
                //         const family = await t.get(newFamily)
                //         console.log(family)
                //     })
                // } catch (e) {
                //     console.log('Transaction failure: ', e)
                // }

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil menambahkan keluarga.',
                    data: newFamily
                })
            }
        },
        delete: {
            pre: [
                [
                    { method: helper.initCalendarApi, assign: 'calendar' },
                    { method: helper.userInfo, assign: 'user' }
                ]
            ],
            handler: async (request, h, err) => {
                const calendar = request.pre.calendar
                const payload = request.payload
                const db = getFirestore()

                const familyRef = db.collection('families')
                const snapshot = await familyRef.where('id', '==', payload.id).get()
                if (snapshot.empty) {
                    return h.response({
                        status: 'fail',
                        message: 'Data keluarga tidak ditemukan!'
                    }).code(401)
                }

                const family = snapshot.docs[0].data()
                await calendar.calendars.delete({
                    calendarId: family.calendarId
                })

                snapshot.forEach((doc) => {
                    doc.ref.delete()
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Data keluarga berhasil dihapus!'
                }).code(200)
            }
        }
    }
}

module.exports = handler
