import { inBounds } from "../boardUtils.js";

import { pawnMoves } from "./pawnMoves.js";
import { rookMoves } from "./rookMoves.js";
import { kingMoves } from "./kingMoves.js";
import { queenMoves } from "./queenmoves.js";
import { wolfMoves } from "./wolfMoves.js";
import { devilPrelateMoves } from "./devilPrelateMoves.js";

export function pieceMoves(board, row, col, lastMove, includeCastle = true) {
    const piece = board[row][col];

    if (!piece) return [];

    const moves = [];

    const push = (r, c, extra = {}) => {
        if (inBounds(r, c)) {
            moves.push({
                row: r,
                col: c,
                ...extra,
            });
        }
    };

    switch (piece.type) {
        case "P":
            pawnMoves(board, row, col, push, piece, lastMove);
            break;

        case "R":
            rookMoves(board, row, col, push, piece);
            break;

        case "K":
            kingMoves(board, row, col, push, piece, includeCastle);
            break;

        case "Q":
            queenMoves(board, row, col, push, piece);
            break;

        case "W":
            wolfMoves(board, row, col, push, piece);
            break;

        case "D":
            devilPrelateMoves(board, row, col, push, piece);
            break;

        default:
            break;
    }

    return moves;
}