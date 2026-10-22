
import { useEffect, useMemo, useState } from "react";
import Piece from "./Piece";

function AnimatedPiece({
    piece,
    from,
    to,
    squareSize,
    flipped
}) {
    const [transform, setTransform] = useState(
        "translate(0%, 0%)"
    );

    const displayFrom = useMemo(
        () => flipped
            ? { row: 7 - from.row, col: 7 - from.col }
            : from,
        [from.row, from.col, flipped]
    );

    const displayTo = useMemo(
        () => flipped
            ? { row: 7 - to.row, col: 7 - to.col }
            : to,
        [to.row, to.col, flipped]
    );

    useEffect(() => {
        setTransform("translate(0%, 0%)");

        const frameId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const dx =
                    (displayTo.col - displayFrom.col) * 100;

                const dy =
                    (displayTo.row - displayFrom.row) * 100;

                setTransform(`translate(${dx}%, ${dy}%)`);
            });
        });

        return () => cancelAnimationFrame(frameId);
    }, [
        displayFrom.row,
        displayFrom.col,
        displayTo.row,
        displayTo.col
    ]);

    return (
        <div
            className="animated-piece"
            style={{
                left: `${displayFrom.col * squareSize}%`,
                top: `${displayFrom.row * squareSize}%`,
                transform
            }}
        >
            <Piece piece={piece} />
        </div>
    );
}

export default AnimatedPiece;
