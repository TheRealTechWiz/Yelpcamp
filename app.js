var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');       //passport
var passport = require('passport');             //passport
var passportLocalMongoose = require('passport-local-mongoose');   //passport
var LocalStrategy = require('passport-local');
var methodOverride = require('method-override');


app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

app.use(session({                               //passport express-session
    secret: 'This the secret line',              //passport express-session
    resave: false,                               //passport express-session
    saveUninitialized: false                     //passport express-session
}));                                            //passport express-session
app.use(passport.initialize());                 //passport
app.use(passport.session());                    //passport
app.use(methodOverride('_method'));


mongoose.connect("mongodb+srv://admin:Createw3.@cluster0-byaob.mongodb.net/yelp_camp", { useNewUrlParser: true, useUnifiedTopology: true });
//mongoose.connect("mongodb://localhost:27017/yelp_camp", { useNewUrlParser: true, useUnifiedTopology: true });
//mongoose.set("useCreateIndex",true);

//==================MongooseSchemasAndModels=======================
var userSchema = new mongoose.Schema({ username: String, password: String });
userSchema.plugin(passportLocalMongoose);           //passport
var User = mongoose.model("User", userSchema);

var commentsSchema = new mongoose.Schema(
    {
    content: String,
    author:{
        id:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User'
        },
        username: String
    } 
    });
var Comments = mongoose.model("Comments", commentsSchema);

var campgroundsSchema = new mongoose.Schema({
    name: String,
    image: String,
    description: String,
    author:{
        id:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User'
        },
        username: String
    },
    comment: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comments'
    }]
});
var Campground = mongoose.model("Campground", campgroundsSchema);



passport.use(new LocalStrategy(User.authenticate())); //passport colt
//passport.use(User.createStrategy());                //passport passport-local-mongoose angela
passport.serializeUser(User.serializeUser());       //passport passport-local-mongoose
passport.deserializeUser(User.deserializeUser());   //passport passport-local-mongoose

app.use(function(req,res,next){
    res.locals.currentUser = req.user;
    next();
});

//=================================Routes=====================

app.get("/", function (req, res) {
    res.render("homePage.ejs");
});

app.get("/camps/new",isLoggedIn, function (req, res) {
    res.render("create.ejs")
});

app.get("/camps", function (req, res) {
    Campground.find({}, function (err, cmp) {
        if (err) { console.log(err); }
        else { res.render("camps", { campgrounds: cmp }); }
    });
});


app.get("/camps/:id", function (req, res) {
    Campground.findById(req.params.id).populate("comment").exec(function (err, cmp) {
        if (err) { console.log(err); }
        else { res.render("campsdes", { campgrounds: cmp }); }
    });
});

app.post("/camps",isLoggedIn, function (req, res) {
    var createdAuthor = {id:req.user._id,username:req.user.username};
    var newcamp = { name: req.body.name, image: req.body.image, description: req.body.description,author:createdAuthor };
    //Campgrounds.push(newcamp);
    Campground.create(newcamp, function (err, cmp) {
        if (err) { console.log(err); }
        else { console.log("Campground Created"); console.log(cmp); res.redirect("/camps"); }
    });
});

//========================Auth============================

app.get("/register", function (req, res) {
    res.render('register');
});

app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.render("register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/camps");
            });
        }
    });

});

app.get("/login", function (req, res) {
    res.render('login');
});

//login post angela
// app.post("/login", function (req, res) {
//     var user = new User({
//         username: req.body.username,
//         password: req.body.password});
//     req.login(user, function (err) {
//         if (err) {
//             console.log(err);
//             res.render('login'); }
//         else {
//             passport.authenticate("local")(req, res, function () {
//                 res.redirect("/secret");
//             }); } }); });

app.post("/login",passport.authenticate("local",{successRedirect:"/camps",failureRedirect:"/login"}),function(req,res){});


app.get("/logout", function (req, res) {
   req.logout();
   res.redirect('/');
});


//======================comment==================

app.get("/camps/:id/comments/new",isLoggedIn, function (req, res) {
    var theid = req.params.id;
    res.render("newcomment", { campid: theid });
});

app.post("/camps/:id/comments",isLoggedIn, function (req, res) {
    var foundid = req.params.id;
    var cmnt = req.body.comment;

    Campground.findById(req.params.id, function (err, cmp) {
        if (err) { console.log(err); }
        else {
            Comments.create(cmnt, function (err, createdComment) {
                if (err) { console.log(err); }
                else {
                    createdComment.author.id=req.user._id;
                    createdComment.author.username=req.user.username;
                    createdComment.save();
                    cmp.comment.push(createdComment);
                    cmp.save();
                    res.redirect("/camps/" + foundid);
                }
            });
        }
    });
});

//=====================campEdit=============
app.get("/camps/:id/edit",checkCampOwnership,function(req,res){
    Campground.findById(req.params.id,function(err,cmp){
        if(err){console.log(err);}
        else{
            res.render('campedit',{camp:cmp});
        }
    });
});

app.put("/camps/:id",checkCampOwnership,function(req,res){
    Campground.findByIdAndUpdate(req.params.id,req.body.comment,function(err,editedCamp){
        if(err){console.log(err);}
        else{
            console.log(editedCamp);
            res.redirect('/camps/'+req.params.id);
        }
    });
});

app.delete('/camps/:id',checkCampOwnership,function(req,res){
    Campground.findByIdAndDelete(req.params.id,function(err){
        if(err){console.log(err);}
        else{
            console.log("Successfully Deleted");
            res.redirect('/camps');
        }
    });
});


//==================commentEdit==============
app.get('/camps/:id/comments/:comment_id/edit',checkCommentOwnership,function(req,res){
    Comments.findById(req.params.comment_id,function(err,foundcomment){
        if(err){console.log(err);}
        else{
            res.render('comedit',{comment:foundcomment,campground_id:req.params.id});
        }
    });
});

app.put('/camps/:id/comments/:comment_id',checkCommentOwnership,function(req,res){
    Comments.findByIdAndUpdate(req.params.comment_id,req.body.comment,function(err){
        if(err){console.log(err);}
        else{res.redirect('/camps/'+req.params.id);}
    })
});

app.delete('/camps/:id/comments/:comment_id',checkCommentOwnership,function(req,res){
    Comments.findByIdAndDelete(req.params.comment_id,function(err){
        if(err){console.log(err);}
        else{res.redirect('/camps/'+req.params.id);}
    })
});



function isLoggedIn(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }else{
        res.redirect('/login');
    }
}

function checkCampOwnership(req,res,next){
    if(req.isAuthenticated()){
        Campground.findById(req.params.id,function(err,foundcamp){
            if(err){res.redirect('back');}
            else{
                if(foundcamp.author.id.equals(req.user._id)){
                    next();
                }
                else{res.redirect('back');}
            }
        });
    }else{res.redirect('/login');}
}

function checkCommentOwnership(req,res,next){
    if(req.isAuthenticated()){
        Comments.findById(req.params.comment_id,function(err,foundcom){
            if(err){res.redirect('back');}
            else{
                if(foundcom.author.id.equals(req.user._id)){
                    next();
                }
                else{res.redirect('back');}
            }
        });
    }else{res.redirect('/login');}
}

app.listen(3000, function () {
    console.log("Listening at port 3000");
});