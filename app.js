require('dotenv').config()
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');       //passport
var passport = require('passport');             //passport
var passportLocalMongoose = require('passport-local-mongoose');   //passport
var LocalStrategy = require('passport-local');
var methodOverride = require('method-override');
var flash = require('connect-flash');


app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

app.use(session({                               //passport express-session
    secret: process.env.SECRET,              //passport express-session
    resave: false,                               //passport express-session
    saveUninitialized: false                     //passport express-session
}));                                            //passport express-session
app.use(passport.initialize());                 //passport
app.use(passport.session());                    //passport
app.use(methodOverride('_method'));
app.use(flash());

mongoose.connect(process.env.DATABASEURL, { useNewUrlParser: true, useUnifiedTopology: true });
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
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
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
        if (err) { console.log(err);req.flash('error',err.message); }
        else { res.render("camps", { campgrounds: cmp }); }
    });
});


app.get("/camps/:id", function (req, res) {
    Campground.findById(req.params.id).populate("comment").exec(function (err, cmp) {
        if (err) { console.log(err);req.flash('error',err.message); }
        else { res.render("campsdes", { campgrounds: cmp }); }
    });
});

app.post("/camps",isLoggedIn, function (req, res) {
    var createdAuthor = {id:req.user._id,username:req.user.username};
    var newcamp = { name: req.body.name, image: req.body.image, description: req.body.description,author:createdAuthor };
    //Campgrounds.push(newcamp);
    Campground.create(newcamp, function (err, cmp) {
        if (err) { console.log(err);req.flash('error',err.message); }
        else { console.log("Campground Created"); console.log(cmp);
        req.flash('success','Successfully created');
        res.redirect("/camps"); }
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
            req.flash('error',err.message);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                req.flash('success','Welcome '+user.username);
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
   req.flash('success','Successfuly Logged Out');
   res.redirect('/');
});


//======================comment==================

app.get("/camps/:id/comments/new",isLoggedIn, function (req, res) {
    res.render("newcomment", { campid: req.params.id });
});

app.post("/camps/:id/comments",isLoggedIn, function (req, res) {
    var foundid = req.params.id;
    var cmnt = req.body.comment;

    Campground.findById(req.params.id, function (err, cmp) {
        if (err) { console.log(err);req.flash('error',err.message); }
        else {
            Comments.create(cmnt, function (err, createdComment) {
                if (err) { console.log(err);req.flash('error',err.message); }
                else {
                    createdComment.author.id=req.user._id;
                    createdComment.author.username=req.user.username;
                    createdComment.save();
                    cmp.comment.push(createdComment);
                    cmp.save();
                    req.flash('success','Comment Successfully created');
                    res.redirect("/camps/" + foundid);
                }
            });
        }
    });
});

//=====================campEdit=============
app.get("/camps/:id/edit",checkCampOwnership,function(req,res){
    Campground.findById(req.params.id,function(err,cmp){
        if(err){console.log(err);req.flash('error',err.message);}
        else{
            res.render('campedit',{camp:cmp});
        }
    });
});

app.put("/camps/:id",checkCampOwnership,function(req,res){
    Campground.findByIdAndUpdate(req.params.id,req.body.comment,function(err,editedCamp){
        if(err){console.log(err);req.flash('error',err.message);}
        else{
            console.log(editedCamp);
            req.flash('success','Successfully Edited');
            res.redirect('/camps/'+req.params.id);
        }
    });
});

app.delete('/camps/:id',checkCampOwnership,function(req,res){
    Campground.findByIdAndDelete(req.params.id,function(err){
        if(err){console.log(err);}
        else{
            console.log("Successfully Deleted");
            req.flash('success','Successfully Deleted');
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
        if(err){console.log(err);req.flash('error',err.message);}
        else{req.flash('success','Comment Successfully Edited');res.redirect('/camps/'+req.params.id);}
    })
});

app.delete('/camps/:id/comments/:comment_id',checkCommentOwnership,function(req,res){
    Comments.findByIdAndDelete(req.params.comment_id,function(err){
        if(err){console.log(err);}
        else{
            req.flash('success','Successfully Deleted');
            res.redirect('/camps/'+req.params.id);
        }
    })
});



function isLoggedIn(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }else{
        req.flash('error','You must login first');
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
                else{
                    req.flash('error',"You don't have the permission to do that");
                    res.redirect('back');
                }
            }
        });
    }else{
        req.flash('error','You must login first');
        res.redirect('/login');
    }
}

function checkCommentOwnership(req,res,next){
    if(req.isAuthenticated()){
        Comments.findById(req.params.comment_id,function(err,foundcom){
            if(err){res.redirect('back');}
            else{
                if(foundcom.author.id.equals(req.user._id)){
                    next();
                }
                else{
                    req.flash('error',"You don't have the permission to do that");
                    res.redirect('back');
                }
            }
        });
    }else{
        req.flash('error','You must login first');
        res.redirect('/login');
    }
}

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function () {
    console.log("Listening at port 3000");
});