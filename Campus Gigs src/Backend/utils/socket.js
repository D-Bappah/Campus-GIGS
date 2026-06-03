let io;

module.exports = {
    init(httpServer, allowedOrigins) {
        io = require('socket.io')(httpServer, {
            cors: {
                origin: allowedOrigins,
                methods: ['GET', 'POST'],
                credentials: true
            }
        });
        return io;
    },
    get() {
        return io;
    }
};
