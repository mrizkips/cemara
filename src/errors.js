class TokenValidationError extends Error {
    constructor (message) {
        super(message)
        this.name = 'TokenValidationError'
    }
}

class FirebaseError extends Error {
    constructor (message) {
        super(message)
        this.name = 'FirebaseError'
    }
}

class CalendarError extends Error {
    constructor (message) {
        super(message)
        this.name = 'CalendarError'
    }
}

module.exports = { TokenValidationError, FirebaseError, CalendarError }
