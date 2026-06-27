const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    }
});

// THE BULLETPROOF FIX:
// If the package exports as an object, use the .default property. 
// Otherwise, use it directly. This guarantees Mongoose gets the function it needs!
const pluginFunction = passportLocalMongoose.default || passportLocalMongoose;
UserSchema.plugin(pluginFunction);

module.exports = mongoose.model('User', UserSchema);
