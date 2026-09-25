import { io } from "socket.io-client";
const URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
export const SERVER_URL = URL; // same Express app the Socket.io connection uses — reused for the admin HTTP API
export const socket = io(URL, { autoConnect:true, reconnection:true, reconnectionDelay:1000 });
export default socket;
