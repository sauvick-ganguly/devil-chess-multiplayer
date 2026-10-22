
import { useState } from "react";
import socket from "../multiplayer/socket";
import "../MultiplayerLobby.css";

function MultiplayerLobby({ onRoomReady }) {
  const [roomCode, setRoomCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function createRoom() {
    if (loading) return;

    setLoading(true);
    setMessage("");
    setCreatedCode("");
    setCopied(false);

    if (!socket.connected) {
      socket.connect();
    }

    const create = () => {
      socket.emit("create-room", (result) => {
        setLoading(false);

        if (!result?.success) {
          setMessage("Could not create the room. Please try again.");
          return;
        }

        setCreatedCode(result.roomCode);
        onRoomReady(result);
      });
    };

    if (socket.connected) {
      create();
    } else {
      socket.once("connect", create);
      socket.once("connect_error", () => {
        setLoading(false);
        setMessage("Unable to connect to the server.");
      });
    }
  }

  function joinRoom() {
    if (loading) return;

    const code = roomCode.trim().toUpperCase();

    if (!code) {
      setMessage("Enter an invitation code to join the battle.");
      return;
    }

    setLoading(true);
    setMessage("");

    const join = () => {
      socket.emit("join-room", code, (result) => {
        setLoading(false);

        if (!result?.success) {
          setMessage(result?.message || "Could not join the room.");
          return;
        }

        onRoomReady(result);
      });
    };

    if (socket.connected) {
      join();
    } else {
      socket.connect();
      socket.once("connect", join);
      socket.once("connect_error", () => {
        setLoading(false);
        setMessage("Unable to connect to the server.");
      });
    }
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Copy failed. Please copy the room code manually.");
    }
  }

  return (
    <main className="devil-lobby">
      <div className="lobby-ambient ambient-one" />
      <div className="lobby-ambient ambient-two" />

      <section className="lobby-shell">
        <header className="lobby-header">
          <span className="lobby-eyebrow">
            THE BATTLE AWAITS
          </span>

          <div className="lobby-emblem">♚</div>

          <h1>
            DEVIL'S <span>CHESS</span>
          </h1>

          <p className="lobby-subtitle">
            Challenge a worthy opponent. Let the battlefield decide.
          </p>

          <div className="lobby-divider">
            <span />
            <i>✦</i>
            <span />
          </div>
        </header>

        <div className="lobby-panels">
          <section className="lobby-card create-card">
            <div className="lobby-card-icon">⚔</div>

            <span className="lobby-card-label">HOST A MATCH</span>
            <h2>Create a Room</h2>

            <p>
              Open a private battlefield and invite a friend
              to challenge you.
            </p>

            <button
              className="lobby-button create-button"
              onClick={createRoom}
              disabled={loading}
            >
              {loading ? "PREPARING..." : "CREATE BATTLE"}
            </button>

            {createdCode && (
              <div className="invitation-panel">
                <span className="invitation-label">
                  YOUR INVITATION CODE
                </span>

                <div className="invitation-code">
                  {createdCode}
                </div>

                <button
                  className="copy-code-button"
                  onClick={copyRoomCode}
                >
                  {copied ? "✓ COPIED" : "▣ COPY CODE"}
                </button>

                <p>Share this code with your opponent.</p>
              </div>
            )}
          </section>

          <div className="lobby-or">
            <span>OR</span>
          </div>

          <section className="lobby-card join-card">
            <div className="lobby-card-icon">♜</div>

            <span className="lobby-card-label">ACCEPT A CHALLENGE</span>
            <h2>Join a Room</h2>

            <p>
              Already have an invitation? Enter its code
              to enter the battlefield.
            </p>

            <form
              className="join-form"
              onSubmit={(event) => {
                event.preventDefault();
                joinRoom();
              }}
            >
              <label htmlFor="room-code">
                INVITATION CODE
              </label>

              <input
                id="room-code"
                className="room-code-input"
                value={roomCode}
                onChange={(event) => {
                  setRoomCode(
                    event.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .slice(0, 6)
                      .toUpperCase()
                  );
                  setMessage("");
                }}
                placeholder="ENTER CODE"
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={message ? "lobby-message" : undefined}
              />

              <button
                className="lobby-button join-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "ENTERING..." : "JOIN BATTLE"}
              </button>
            </form>
          </section>
        </div>

        {message && (
          <div
            id="lobby-message"
            className="lobby-message"
            role="alert"
          >
            <span>⚠</span> {message}
          </div>
        )}

        <footer className="lobby-footer">
          <span className="status-dot" />
          PRIVATE MATCHES
          <span className="footer-separator">◆</span>
          INVITATION ONLY
        </footer>
      </section>
    </main>
  );
}

export default MultiplayerLobby;
