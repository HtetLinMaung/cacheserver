module.exports = (io, socket) => (id) => {
  socket.join(id);
};
