import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import crypto from "crypto";
import { createInitialBoard } from "../src/utils/constants.js";

import {
  pieceMoves,
  applyMove,
  isKingInCheck,
  getGameStatus,
  getCheckNotation,
} from "../src/utils/gameLogic.js";

const app = express();
const server = http.createServer(app);


app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://devil-chess-multiplayer.vercel.app",
      "https://multiplayer.devilchess.com"
    ],
    methods: ["GET", "POST"],
  },
});

// In-memory room storage
const rooms = new Map();

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Devil's Chess Multiplayer Server is running!");
});

function generateRoomCode() {
  let code;

  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));

  return code;
}

function getPlayerColor(room, socketId) {
  if (room.players.w === socketId) return "w";
  if (room.players.b === socketId) return "b";
  return null;
}

function isValidSquare(square) {
  return (
    square &&
    Number.isInteger(square.row) &&
    Number.isInteger(square.col) &&
    square.row >= 0 &&
    square.row < 8 &&
    square.col >= 0 &&
    square.col < 8
  );
}

function rejectMove(socket, message) {
  socket.emit("move-rejected", { message });
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Create a private room. The host plays White.
  socket.on("create-room", (callback) => {
    const roomCode = generateRoomCode();

    const room = {
      code: roomCode,
      players: {
        w: socket.id,
        b: null,
      },
      status: "waiting",
      game: null,
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    console.log(`Room ${roomCode} created by ${socket.id}`);

    callback?.({
      success: true,
      roomCode,
      color: "w",
    });
  });

  // Join a room using its invitation code.
  socket.on("join-room", (roomCode, callback) => {
    const code = String(roomCode ?? "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      callback?.({
        success: false,
        message: "Room not found.",
      });
      return;
    }

    if (room.status !== "waiting" || room.players.b) {
      callback?.({
        success: false,
        message: "This room is already full.",
      });
      return;
    }

    room.players.b = socket.id;
    room.status = "playing";

    socket.join(code);

    callback?.({
      success: true,
      roomCode: code,
      color: "b",
    });

    io.to(code).emit("player-joined", {
      roomCode: code,
      status: "playing",
    });

    // If the host has already initialized the game, send it to Black.
    if (room.game) {
      socket.emit("game-state", room.game);
    }

    console.log(`Player ${socket.id} joined room ${code}`);
  });

  // The host initializes the shared game.
  socket.on("initialize-game", (payload = {}) => {
    const { roomCode, game } = payload;
    const room = rooms.get(roomCode);

    if (!room || room.players.w !== socket.id) return;
    if (room.game || !game || !Array.isArray(game.board)) return;

    room.game = {
      ...game,
      turn: "w",
      lastMove: null,
      moveHistory: [],
      gameOver: false,
      winner: null,
      queenRevived: game.queenRevived ?? {
        w: false,
        b: false,
      },
    };

    io.to(roomCode).emit("game-state", room.game);

    console.log(`Game initialized in room ${roomCode}`);
  });

  // Server-authoritative move processing.
  
socket.on("move-request", (payload = {}) => {
  const { roomCode, moveRequest } = payload;
  const room = rooms.get(roomCode);

  if (!room || room.status !== "playing" || !room.game) {
    rejectMove(socket, "Game is not ready.");
    return;
  }

  const playerColor = getPlayerColor(room, socket.id);

  if (!playerColor) {
    rejectMove(socket, "You are not a player in this room.");
    return;
  }

  if (room.game.gameOver) {
    rejectMove(socket, "The game is already over.");
    return;
  }

  if (room.game.turn !== playerColor) {
    rejectMove(socket, "It is not your turn.");
    return;
  }

  const { from, to, promotionType } = moveRequest ?? {};

  if (!isValidSquare(from) || !isValidSquare(to)) {
    rejectMove(socket, "Invalid source or destination square.");
    return;
  }

  if (from.row === to.row && from.col === to.col) {
    rejectMove(socket, "Choose a different destination square.");
    return;
  }

  const { board, lastMove } = room.game;

  if (
    !Array.isArray(board) ||
    board.length !== 8 ||
    board.some((row) => !Array.isArray(row) || row.length !== 8)
  ) {
    rejectMove(socket, "The game board is invalid.");
    return;
  }

  const piece = board[from.row][from.col];

  if (!piece || piece.color !== playerColor) {
    rejectMove(socket, "You cannot move that piece.");
    return;
  }

  const possibleMoves = pieceMoves(
    board,
    from.row,
    from.col,
    lastMove
  );

  const legalMove = possibleMoves.find(
    (candidate) =>
      candidate.row === to.row &&
      candidate.col === to.col
  );

  if (!legalMove) {
    rejectMove(socket, "That move is not allowed.");
    return;
  }

  const isPromotion =
    piece.type === "P" &&
    ((piece.color === "w" && to.row === 0) ||
      (piece.color === "b" && to.row === 7));

  const queenRevived = {
    w: room.game.queenRevived?.w ?? false,
    b: room.game.queenRevived?.b ?? false,
  };

  const isResurrection =
    isPromotion && !queenRevived[playerColor];

  // Later promotions require an explicit choice.
  if (
    isPromotion &&
    !isResurrection &&
    !["W", "R"].includes(promotionType)
  ) {
    rejectMove(socket, "Choose Wolf or Rook for promotion.");
    return;
  }

  const destinationPiece = board[to.row][to.col];

  const capturedPiece = legalMove.enPassant
    ? board[from.row][to.col]
    : destinationPiece;

  let nextBoard = applyMove(
    board,
    from.row,
    from.col,
    to.row,
    to.col,
    legalMove
  );

  // Apply Devil's Chess promotion rules on the server.
  if (isPromotion && isResurrection) {
    // Remove the promoting pawn.
    nextBoard[to.row][to.col] = null;

    // Revive the same-color Queen by replacing the Devil King.
    let queenRestored = false;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const currentPiece = nextBoard[r][c];

        if (
          currentPiece &&
          currentPiece.type === "K" &&
          currentPiece.color === playerColor &&
          currentPiece.id === 1
        ) {
          nextBoard[r][c] = {
            type: "Q",
            color: playerColor,
            hasMoved: currentPiece.hasMoved,
          };

          queenRestored = true;
        }
      }
    }

    if (!queenRestored) {
      rejectMove(socket, "The Devil King for resurrection was not found.");
      return;
    }

    queenRevived[playerColor] = true;
  } else if (isPromotion) {
    nextBoard[to.row][to.col] = {
      ...nextBoard[to.row][to.col],
      type: promotionType,
    };
  }

  // Validate king safety on the final board, after promotion/revival.
  if (isKingInCheck(nextBoard, playerColor)) {
    rejectMove(socket, "That move leaves your king in check.");
    return;
  }

  const nextTurn = playerColor === "w" ? "b" : "w";
  const status = getGameStatus(nextBoard, nextTurn);
  const opponentColor = nextTurn;

  const { check, checkmate } = getCheckNotation(
    nextBoard,
    opponentColor,
    nextTurn
  );

  const sound = checkmate
    ? "checkmate"
    : check
      ? "check"
      : capturedPiece
        ? "capture"
        : isPromotion
          ? "promote"
          : "move";

  const movingPiece = {
    ...piece,
    hasMoved: true,
  };

  const nextLastMove = {
    piece: movingPiece,
    color: playerColor,
    from: { row: from.row, col: from.col },
    to: { row: to.row, col: to.col },
    sound,
    promotion: isPromotion
      ? isResurrection
        ? "Q"
        : promotionType
      : null,
    resurrection: isResurrection,
  };

  const nextHistoryEntry = {
    piece: movingPiece,
    color: playerColor,
    from: { row: from.row, col: from.col },
    to: { row: to.row, col: to.col },
    promotion: nextLastMove.promotion,
    resurrection: isResurrection,
  };

  room.game = {
    ...room.game,
    board: nextBoard,
    turn: nextTurn,
    lastMove: nextLastMove,
    moveHistory: [
      ...(room.game.moveHistory ?? []),
      nextHistoryEntry,
    ],
    queenRevived,
    gameOver: status.gameOver,
    winner: status.winner,
  };

  console.log(
    `${playerColor === "w" ? "White" : "Black"} moved from`,
    from,
    "to",
    to,
    `in room ${roomCode}; sound: ${sound}`
  );

  io.to(roomCode).emit("game-state", room.game);
});


socket.on("restart-game", (payload = {}) => {
  const { roomCode } = payload;
  const room = rooms.get(roomCode);

  if (!room || room.status !== "playing") return;

  const playerColor = getPlayerColor(room, socket.id);
  if (!playerColor) return;

  room.game = {
    board: createInitialBoard(),
    turn: "w",
    moveHistory: [],
    lastMove: null,
    queenRevived: { w: false, b: false },
    gameOver: false,
    winner: null,
  };

  io.to(roomCode).emit("game-state", room.game);

  console.log(`Game restarted in room ${roomCode} by ${playerColor}`);
});

  // Handle disconnection.
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    for (const [code, room] of rooms) {
      if (
        room.players.w === socket.id ||
        room.players.b === socket.id
      ) {
        io.to(code).emit("opponent-disconnected");

        rooms.delete(code);
        console.log(`Room ${code} closed`);

        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});