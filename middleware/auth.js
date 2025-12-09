const log = require('../debug_logger');

const redirectLogin = (req, res, next) => {
    log(`Auth Check: Session User is ${JSON.stringify(req.session.user)}`);
    if (!req.session.user) {
        log('Auth Check: Redirecting to login');
        res.redirect('/users/login');
    } else {
        log('Auth Check: Access granted');
        next();
    }
};

module.exports = redirectLogin;