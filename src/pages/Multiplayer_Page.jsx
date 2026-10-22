
import { useEffect, useRef, useState } from "react";
import MultiplayerLobby from "../components/MultiplayerLobby";
import whiteWolf from "../assets/white/whiteWolf.png";
import blackWolf from "../assets/black/blackWolf.png";
import ChessBoard from "../components/ChessBoard";
import useGame from "../hooks/useGame";
import socket from "../multiplayer/socket";
import { createInitialBoard } from "../utils/constants";
import "../MultiplayerPage.css";

function MultiplayerPage() {
  const [room, setRoom] = useState(null);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [onlineMoveEvent, setOnlineMoveEvent] = useState(null);

  const previousGameStateRef = useRef(null);
  const onlineMoveIdRef = useRef(0);
  const lastRevivalMoveRef = useRef(null);

  const game = useGame();

  useEffect(() => {
    function handlePlayerJoined() {
      setOpponentJoined(true);
    }

    function handleGameState(state) {
      const previous = previousGameStateRef.current;
      const move = state.lastMove;

      const previousHistoryLength =
        previous?.moveHistory?.length ?? 0;

      const currentHistoryLength =
        state.moveHistory?.length ?? 0;

      const isNewMove =
        previous &&
        currentHistoryLength > previousHistoryLength &&
        move?.from &&
        move?.to;

      if (isNewMove) {
        if (move.resurrection) {
          const revivalId =
            `${move.color}-${move.from.row}-${move.from.col}-` +
            `${move.to.row}-${move.to.col}-${currentHistoryLength}`;

          if (lastRevivalMoveRef.current !== revivalId) {
            lastRevivalMoveRef.current = revivalId;

            game.setRevivalMessage({
              icon: move.color === "w" ? whiteWolf : blackWolf,
              title: "The Devil's Curse has been Lifted",
              subtitle:
                move.color === "w"
                  ? "The White Queen has returned."
                  : "The Black Queen has returned.",
            });
          }
        }

        const previousBoard = previous.board;

        const movedPiece =
          previousBoard?.[move.from.row]?.[move.from.col] ||
          {
            type: move.piece,
            color: move.color,
          };

        const destinationPiece =
          previousBoard?.[move.to.row]?.[move.to.col];

        const isEnPassant =
          movedPiece.type === "P" &&
          move.from.col !== move.to.col &&
          !destinationPiece;

        const sound =
          move.sound ||
          (destinationPiece || isEnPassant
            ? "capture"
            : "move");

        setOnlineMoveEvent({
          id: ++onlineMoveIdRef.current,
          piece: movedPiece,
          from: move.from,
          to: move.to,
          sound,
        });
      }

      previousGameStateRef.current = state;
      setGameState(state);
    }

    socket.on("player-joined", handlePlayerJoined);
    socket.on("game-state", handleGameState);

    return () => {
      socket.off("player-joined", handlePlayerJoined);
      socket.off("game-state", handleGameState);
    };
  }, [game.setRevivalMessage]);

  useEffect(() => {
    if (!gameState) return;

    game.setBoard(gameState.board);
    game.setTurn(gameState.turn);
    game.setMoveHistory(gameState.moveHistory || []);
    game.setLastMove(gameState.lastMove || null);
    game.setQueenRevived(
      gameState.queenRevived || { w: false, b: false }
    );

    game.setGameOver(gameState.gameOver || false);
    game.setWinner(gameState.winner || null);
    game.setSelectedSquare(null);
    game.setLegalMoves([]);
  }, [gameState]);

  useEffect(() => {
    if (room) {
      game.setFlipped(room.color === "b");
    }
  }, [room?.color]);

  useEffect(() => {
    if (!game.revivalMessage) return;

    const timer = setTimeout(() => {
      game.setRevivalMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [game.revivalMessage]);

  function handleRoomReady(result) {
    setRoom(result);

    if (result.color === "b") {
      setOpponentJoined(true);
    }

    if (result.color === "w") {
      const initialGame = {
        board: createInitialBoard(),
        turn: "w",
        moveHistory: [],
        lastMove: null,
        queenRevived: { w: false, b: false },
        gameOver: false,
        winner: null,
      };

      socket.emit("initialize-game", {
        roomCode: result.roomCode,
        game: initialGame,
      });
    }
  }

  function handleNewGame() {
    if (!room) return;

    game.setRevivalMessage("");
    lastRevivalMoveRef.current = null;

    socket.emit("restart-game", {
      roomCode: room.roomCode,
    });
  }

  function handleMoveRequest(moveRequest) {
    if (!room || !opponentJoined) return;

    socket.emit("move-request", {
      roomCode: room.roomCode,
      moveRequest,
    });
  }

  if (!room) {
    return <MultiplayerLobby onRoomReady={handleRoomReady} />;
  }

  const gameReady = opponentJoined && Boolean(gameState);

  return (
    <main className="online-game-page">
      <div className="online-game-ambient" />

      <header className="online-game-header">
        <div className="online-game-brand">
          <span className="online-brand-emblem">
            <img
              src={room.color === "w" ? whiteWolf : blackWolf}
              alt={room.color === "w" ? "White Wolf" : "Black Wolf"}
              className="online-brand-wolf"
            />
          </span>

          <div>
            <span className="online-brand-kicker">
              THE BATTLEFIELD
            </span>
            <h1>
              DEVIL'S <span>CHESS</span>
            </h1>
          </div>
        </div>

        <div className="online-room-details">
          <div className="online-room-code">
            <span className="room-detail-label">ROOM CODE</span>
            <strong>{room.roomCode}</strong>
          </div>

          <div className="online-player-color">
            <span className="room-detail-label">YOUR SIDE</span>
            <strong className="online-player-color-label">
              <span
                className={`player-color-circle ${room.color === "w" ? "white-circle" : "black-circle"
                  }`}
              />
              {room.color === "w" ? "WHITE" : "BLACK"}
            </strong>
          </div>
        </div>
      </header>

      {!gameReady ? (
        <section className="battle-waiting-screen">
          <div className="waiting-rune">⚔</div>

          <span className="waiting-eyebrow">
            PRIVATE BATTLE
          </span>

          <h2>
            {opponentJoined
              ? "Preparing the Battlefield"
              : "Awaiting Your Opponent"}
          </h2>

          <p className="waiting-description">
            {opponentJoined
              ? "Your opponent has arrived. The pieces are being summoned..."
              : "Your battlefield is ready. Invite your rival to begin the duel."}
          </p>

          {!opponentJoined && (
            <>
              <div className="waiting-invitation">
                <span>SHARE THIS ROOM CODE</span>
                <strong>{room.roomCode}</strong>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(room.roomCode)
                      .catch(() => { });
                  }}
                >
                  COPY INVITATION CODE
                </button>
              </div>

              <div className="opponent-waiting-status">
                <span className="waiting-pulse" />
                WAITING FOR SECOND PLAYER
              </div>
            </>
          )}

          {opponentJoined && (
            <div className="opponent-waiting-status">
              <span className="waiting-pulse" />
              OPPONENT CONNECTED
            </div>
          )}
        </section>
      ) : (
        <section className="online-battle-arena">
          <div className="battle-status-bar">
            <div className="battle-status-indicator">
              <span className="battle-live-dot" />
              LIVE MATCH
            </div>

            <div className="battle-turn-status">
              {gameState.gameOver
                ? "BATTLE CONCLUDED"
                : gameState.turn === room.color
                  ? "YOUR TURN"
                  : "OPPONENT'S TURN"}
            </div>
          </div>

          <div className="online-board-container">
            <ChessBoard
              game={game}
              online={true}
              playerColor={room.color}
              onMoveRequest={handleMoveRequest}
              onNewGame={handleNewGame}
              onlineMoveEvent={onlineMoveEvent}
            />
          </div>
        </section>
      )}
    </main>
  );
}

export default MultiplayerPage;
