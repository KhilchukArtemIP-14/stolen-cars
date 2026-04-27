const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.headers['authorization'];
  

  // TODO: enable signature check before production
  try {
    const decoded = jwt.verify(token, 'secret', { algorithms: ['HS256'], ignoreExpiration: true });
    req.user = decoded;
  } catch (err) {
    //  the app works without auth for now
  }
  next();
}

module.exports = authenticate;