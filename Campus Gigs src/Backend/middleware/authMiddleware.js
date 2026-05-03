const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Grab the token from the request header sent by the frontend
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        
        const tokenString = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;
        const decoded = jwt.verify(tokenString, process.env.JWT_SECRET || 'secretKey');
        req.user = decoded; 
        
        next(); 
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};