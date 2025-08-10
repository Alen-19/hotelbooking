const mongoose = require('mongoose');
const bookingSchema = new mongoose.Schema({
    loginid: { type: mongoose.Schema.Types.ObjectId, ref: 'login', required: true },
    roomid: { type: mongoose.Schema.Types.ObjectId, ref: 'Rooms', required: true },
    numberofrooms: { type: Number, required: true },
    checkin: { type: Date, required: true },
    checkout: { type: Date, required: true },
    totalamount: { type: Number, required: true },
    status: { type: String, enum: ['booked', 'cancelled', 'completed'], default: 'booked' }
}, {
    timestamps: true
});
const Booking = mongoose.model('Booking', bookingSchema);
module.exports = { Booking };