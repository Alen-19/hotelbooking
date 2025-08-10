const mongoose = require('mongoose');
const categoriesSchema = new mongoose.Schema({
    catname: { type: String, required: true },
    status: { type: Boolean, default: true }
});
const Categories = mongoose.model('Categories', categoriesSchema);
const roomsSchema = new mongoose.Schema({
    noofrooms: { type: Number, required: true },
    catid: { type: mongoose.Schema.Types.ObjectId, ref: 'Categories', required: true },
    price: { type: Number, required: true },
    status: { type: Boolean, default: true },
    availablerooms: { type: Number, required: true },
});
const Rooms = mongoose.model('Rooms', roomsSchema);

module.exports = { Categories, Rooms };
// This code defines a Mongoose schema and model for categories in a MongoDB database.
// The schema includes fields for name, description, status, createdAt, and updatedAt.
// The model is named 'Categories' and can be used to interact with the 'Categories' collection in the database.
// The 'status' field is a boolean that defaults to true, indicating whether the category is active.

