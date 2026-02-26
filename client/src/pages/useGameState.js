import { useState, useEffect, useCallback } from "react";
import socket from "../socket.js";

export function useGameState(courtId) {
  const [state,     setState]     = useState(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState      = (s) => { if (s) setState(s); };

    socket.on("connect",     onConnect);
    socket.on("disconnect",  onDisconnect);
    socket.on("stateUpdate", onState);
    socket.emit("joinCourt", courtId);

    return () => {
      socket.off("connect",     onConnect);
      socket.off("disconnect",  onDisconnect);
      socket.off("stateUpdate", onState);
    };
  }, [courtId]);

  useEffect(() => { socket.emit("joinCourt", courtId); }, [courtId]);

  const send = useCallback((type, team, value) => {
    socket.emit("action", { courtId, type, team, value });
  }, [courtId]);

  return { state, connected, send };
}
