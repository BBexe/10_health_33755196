const redirectLogin = (req, res, next) => {
    console.log(`Auth Check: Session User is ${JSON.stringify(req.session.user)}`);
    if (!req.session.user) {
        console.log('Auth Check: Redirecting to login');
        return res.redirect('../users/login');
    } else {
        console.log('Auth Check: Access granted');
        next();
    }
};

module.exports = redirectLogin;