const { google } = require('googleapis')
const path = require('path')

const generateToken = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    return result
}

const calendarClient = () => {
    const googleAuth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '/../serviceAccount.json'),
        scopes: ['https://www.googleapis.com/auth/calendar']
    })

    const calendar = google.calendar({
        version: 'v3',
        auth: googleAuth
    })

    return calendar
}

async function deleteCollection (db, collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath)
    const query = collectionRef.orderBy('__name__').limit(batchSize)

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject)
    })
}

async function deleteQueryBatch (db, query, resolve) {
    const snapshot = await query.get()

    const batchSize = snapshot.size
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve()
        return
    }

    // Delete documents in a batch
    const batch = db.batch()
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
    })
    await batch.commit()

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve)
    })
}

module.exports = { generateToken, calendarClient, deleteCollection }
