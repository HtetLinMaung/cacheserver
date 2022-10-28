module.exports = (io, socket) => (anotherSocketId, msg) => {
  socket.to(anotherSocketId).emit("chat", socket.id, msg);
};
