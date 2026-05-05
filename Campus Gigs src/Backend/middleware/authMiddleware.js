const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Grab the token from the request header sent by the frontend
    const token = req.header('Authorization');

    console.log("The Bouncer sees this token:", token);

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        
        const tokenString = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;
        const decoded = jwt.verify(tokenString, process.env.JWT_SECRET || 'secretKey');
        req.user = decoded; 
        
        next(); 
    } catch (err) {

        console.error("JWT Verification Failed:", err.message);
        
        res.status(401).json({ message: 'Token is not valid' });
    }
};