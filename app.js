const Campground = require('./models/campground');
const express = require('express');
const app = express();
const path = require('path');
const mongoose=require('mongoose');
const methodOverride = require('method-override');
const Review = require('./models/review');
const { campgroundSchema } = require('./schemas.js');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');


mongoose .connect('mongodb://127.0.0.1:27017/yelp-camp')
.then(()=> {
console.log('mongo connection open!!')})
.catch(err => {
console.log('ho no not connected')
console.log(err)});

const catchAsync = function (fn) {
    return function (req, res, next) {
        fn(req, res, next).catch(e => next(e))
    }
}

// Tell Express to use EJS for our frontend views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.use(methodOverride('_method'));

const sessionConfig = {
    secret: 'thisshouldbeabettersecret!', // In a real app, this is hidden in a .env file
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // Cookie expires in a week (milliseconds * seconds * minutes * hours * days)
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

// Tell Passport to use our Local Strategy, and use the authentication method on our User model
passport.use(new LocalStrategy(User.authenticate()));

// Tell Passport how to store a user in the session (serialize) and how to un-store them (deserialize)
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


const validateCampground = (req, res, next) => {
    // Pass the incoming data through our Joi schema
    const { error } = campgroundSchema.validate(req.body);
    
    if (error) {
        // If there is an error, extract the message and throw it
        const msg = error.details.map(el => el.message).join(',');
        throw new Error(msg); 
    } else {
        // If data is good, move on to the actual route!
        next();
    }
};

// Our very first route!
app.get('/', (req, res) => {
    res.render('home');
});

app.get('/makecampground', async (req, res) => {
    // 1. Create a new campground in JavaScript memory
    const camp = new Campground({ title: 'My Backyard', description: 'Cheap camping!' });
    
    // 2. Save it permanently to MongoDB (this takes time, so we use 'await')
    await camp.save();
    
    // 3. Send the saved data to the browser so we can see it worked
    res.send(camp);
});

// INDEX ROUTE - Show all campgrounds
app.get('/campgrounds', async (req, res) => {
    // 1. Find all campgrounds in the database
    const campgrounds = await Campground.find({});
    
    // 2. Render the index page, and pass the data to it
    res.render('campgrounds/index', { campgrounds: campgrounds });
});

// NEW ROUTE - Show the form
app.get('/campgrounds/new', (req, res) => {
    res.render('campgrounds/new');
});

// CREATE ROUTE - Process the form and save to DB
app.post('/campgrounds', validateCampground, async (req, res, next) => {
    try {
        const campground = new Campground(req.body.campground);
        await campground.save();
        res.redirect(`/campgrounds/${campground._id}`);
    } catch (e) {
        // If the database fails, pass the error to our error handler
        next(e); 
    }
});


// SHOW ROUTE - Show details for one specific campground
// The ':' tells Express that 'id' is a variable in the URL
app.get('/campgrounds/:id', async (req, res) => {
    // 1. Grab the ID from the URL (req.params) and find it in the DB
   const campground = await Campground.findById(req.params.id).populate('reviews');
    
    // 2. Render the show page, passing that one specific campground
    res.render('campgrounds/show', { campground: campground });
});

// DELETE ROUTE
app.delete('/campgrounds/:id', async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    res.redirect('/campgrounds');
});

// POST Route to create a new review
app.post('/campgrounds/:id/reviews', catchAsync(async (req, res) => {
    // 1. Find the parent campground using the URL ID
    const campground = await Campground.findById(req.params.id);
    
    // 2. Create the new review document from form data
    const review = new Review(req.body.review);
    
    // 3. Push the new review into the campground's array
    campground.reviews.push(review);
    
    // 4. Save both to MongoDB
    await review.save();
    await campground.save();
    
    // 5. Redirect back to the campground's detailed show page
    res.redirect(`/campgrounds/${campground._id}`);
}));

// EDIT ROUTE - Show the form with pre-filled data
app.get('/campgrounds/:id/edit', async (req, res) => {
    const campground = await Campground.findById(req.params.id);
    res.render('campgrounds/edit', { campground });
});

// UPDATE ROUTE - Catch the form data and update the database
app.put('/campgrounds/:id', validateCampground ,async (req, res) => {
    try {
        const { id } = req.params;
        // Find the campground by ID and update it with the new data from req.body.campground
        const campground = await Campground.findByIdAndUpdate(id, req.body.campground);
        res.redirect(`/campgrounds/${campground._id}`);
        } catch (e) {
            next(e); 
        }
});

// DELETE Route for a specific review
app.delete('/campgrounds/:id/reviews/:reviewId', catchAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    
    // 1. $pull removes the specific reviewId from the campground's reviews array
    await Campground.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    
    // 2. Delete the actual review document
    await Review.findByIdAndDelete(reviewId);
    
    // 3. Redirect back to the campground show page
    res.redirect(`/campgrounds/${id}`);
}));


app.use((err, req, res, next) => {
    // This catches the error thrown by Joi, or any database errors!
    res.status(500).send(`Oh boy, something went wrong: ${err.message}`);
});


// ====================
// AUTHENTICATION ROUTES
// ====================

// Show Register Form
app.get('/register', (req, res) => {
    res.render('users/register');
});

// Process Registration
app.post('/register', catchAsync(async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        
        // Passport's req.login automatically logs the user in after they register!
        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect('/campgrounds');
        });
    } catch (e) {
        // If username already exists, send them back to the register page
        res.redirect('/register');
    }
}));

// Show Login Form
app.get('/login', (req, res) => {
    res.render('users/login');
});

// Process Login
// passport.authenticate acts as a bouncer. If the password is wrong, it redirects back to /login.
app.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), (req, res) => {
    // If they make it into this function, the password was correct!
    res.redirect('/campgrounds');
});

// Logout Route
app.get('/logout', (req, res, next) => {
    // Passport updated this method recently to require a callback function
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/campgrounds');
    });
});




//app.get('/fakeUser', async (req, res) => {
//    // 1. Create a new user instance (only email and username)
//   const user = new User({ email: 'colt@gmail.com', username: 'colt' });
//    
//    // 2. Pass the user and the password to the register method
//    // Passport will automatically hash 'monkey' and save it to the DB!
//    const newUser = await User.register(user, 'monkey');
//    
//    res.send(newUser);
//});



// Start the server on port 3000
app.listen(3000, () => {
    console.log('Serving on port 3000');
});
