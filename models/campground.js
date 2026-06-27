// models/campground.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CampgroundSchema = new Schema({
    title: String,
    price: Number,
    description: String,
    location: String,
    // NEW: Array of ObjectIDs referencing the Review model
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Review'
        }
    ]
});

// We need to require the Review model at the top of the file if it isn't there already!
const Review = require('./review');

// This middleware runs AFTER a campground is deleted
CampgroundSchema.post('findOneAndDelete', async function (doc) {
    // If we actually found and deleted a document...
    if (doc) {
        // ...delete all reviews whose IDs are in that campground's reviews array
        await Review.deleteMany({
            _id: {
                $in: doc.reviews
            }
        })
    }
});


module.exports = mongoose.model('Campground', CampgroundSchema);
