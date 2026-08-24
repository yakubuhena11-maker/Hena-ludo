"use strict";

/*
 * Hena Ludo
 * Core game engine
 *
 * This first version provides:
 * - 4 players
 * - 4 pieces per player
 * - Dice rolling
 * - Turn management
 * - Rolling a 6 to leave the yard
 * - Legal movement
 * - Capturing
 * - Safe squares
 * - Home paths
 * - Exact roll to finish
 * - Winner detection
 */

const PLAYERS = [
  {
    id: "red",
    name: "Red",
    start: 0,
    colorClass: "piece-red"
  },
  {
    id: "green",
    name: "Green",
    start: 13,
    colorClass: "piece-green"
  },
  {
    id: "yellow",
    name: "Yellow",
    start: 26,
    colorClass: "piece-yellow"
  },
  {
    id: "blue",
    name: "Blue",
    start: 39,
    colorClass: "piece-blue"
  }
];

const TRACK_LENGTH = 52;
const HOME_LENGTH = 6;
const PIECES_PER_PLAYER = 4;

/*
 * Position values:
 *
 * -1 = piece is in yard
 * 0..51 = main board
 * 52..57 = player's home path
 * 58 = finished
 */
const YARD = -1;
const FINISHED = 58;

const SAFE_SQUARES = new Set([
  0,
  8,
  13,
  21,
  26,
  34,
  39,
  47
]);

const game = {
  currentPlayerIndex: 0,
  diceValue: null,
  consecutiveSixes: 0,
  gameOver: false,
  pieces: {},
  initialized: false
};

/* -----------------------------
   DOM ELEMENTS
----------------------------- */

const menuScreen = document.getElementById("menu-screen");
const gameScreen = document.getElementById("game-screen");
const winnerScreen = document.getElementById("winner-screen");

const playLocalBtn = document.getElementById("play-local-btn");
const vsComputerBtn = document.getElementById("vs-computer-btn");
const settingsBtn = document.getElementById("settings-btn");

const backBtn = document.getElementById("back-btn");
const pauseBtn = document.getElementById("pause-btn");
const rollBtn = document.getElementById("roll-btn");

const diceValueElement = document.getElementById("dice-value");
const turnText = document.getElementById("turn-text");
const gameMessage = document.getElementById("game-message");
const boardElement = document.getElementById("ludo-board");

const winnerTitle = document.getElementById("winner-title");
const winnerMessage = document.getElementById("winner-message");

const playAgainBtn = document.getElementById("play-again-btn");
const menuBtn = document.getElementById("menu-btn");

/* -----------------------------
   INITIALIZE GAME
----------------------------- */

function createInitialPieces() {
  game.pieces = {};

  PLAYERS.forEach(player => {
    game.pieces[player.id] = [];

    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      game.pieces[player.id].push({
        id: `${player.id}-${i + 1}`,
        playerId: player.id,
        index: i,
        position: YARD
      });
    }
  });
}

function startGame() {
  createInitialPieces();

  game.currentPlayerIndex = 0;
  game.diceValue = null;
  game.consecutiveSixes = 0;
  game.gameOver = false;
  game.initialized = true;

  menuScreen.classList.add("hidden");
  winnerScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  createBoard();
  updateUI();
}

/* -----------------------------
   BOARD
----------------------------- */

function createBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const cell = document.createElement("div");

      cell.classList.add("board-cell");

      const cellType = getCellType(row, col);

      if (cellType) {
        cell.classList.add(...cellType.split(" "));
      }

      cell.dataset.row = row;
      cell.dataset.col = col;

      boardElement.appendChild(cell);
    }
  }

  renderPieces();
}

function getCellType(row, col) {
  /*
   * Four home areas.
   */

  if (row < 6 && col < 6) {
    return "home-red";
  }

  if (row < 6 && col > 8) {
    return "home-green";
  }

  if (row > 8 && col < 6) {
    return "home-blue";
  }

  if (row > 8 && col > 8) {
    return "home-yellow";
  }

  /*
   * Center.
   */

  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
    return "board-center";
  }

  /*
   * Main track.
   *
   * This is a visual foundation.
   * The actual game positions are controlled
   * by the game engine, not by CSS coordinates.
   */

  const path = getTrackCoordinate(row, col);

  if (path !== null) {
    return "path";
  }

  return "";
}

/*
 * A simple 52-cell perimeter path.
 * The coordinate system will be refined when
 * we build the final board geometry.
 */

function getTrackCoordinate(row, col) {
  const coordinates = [];

  /*
   * Top row
   */
  for (let c = 6; c <= 8; c++) {
    coordinates.push([6, c]);
  }

  /*
   * Right side
   */
  for (let r = 1; r <= 13; r++) {
    coordinates.push([r, 8]);
  }

  /*
   * Bottom
   */
  for (let c = 8; c >= 6; c--) {
    coordinates.push([8, c]);
  }

  /*
   * Left side
   */
  for (let r = 13; r >= 1; r--) {
    coordinates.push([r, 6]);
  }

  const found = coordinates.find(
    coordinate => coordinate[0] === row && coordinate[1] === col
  );

  return found || null;
}

/* -----------------------------
   DICE
----------------------------- */

function rollDice() {
  if (game.gameOver) return;

  const player = getCurrentPlayer();

  const value = Math.floor(Math.random() * 6) + 1;

  game.diceValue = value;

  if (value === 6) {
    game.consecutiveSixes += 1;
  } else {
    game.consecutiveSixes = 0;
  }

  diceValueElement.textContent = value;

  /*
   * Three consecutive sixes rule.
   */

  if (game.consecutiveSixes >= 3) {
    gameMessage.textContent =
      `${player.name} rolled three sixes. Turn lost.`;

    game.diceValue = null;
    game.consecutiveSixes = 0;

    setTimeout(nextTurn, 900);
    return;
  }

  const legalPieces = getLegalPieces(player.id, value);

  if (legalPieces.length === 0) {
    gameMessage.textContent =
      `${player.name} has no legal move.`;

    setTimeout(() => {
      if (value === 6) {
        gameMessage.textContent =
          `${player.name} gets another roll.`;
        rollBtn.disabled = false;
      } else {
        nextTurn();
      }
    }, 900);

    return;
  }

  gameMessage.textContent =
    legalPieces.length === 1
      ? "A legal piece is ready to move."
      : "Choose a piece to move.";

  highlightLegalPieces(legalPieces);

  rollBtn.disabled = true;
}

/* -----------------------------
   MOVE RULES
----------------------------- */

function getLegalPieces(playerId, dice) {
  const pieces = game.pieces[playerId];

  return pieces.filter(piece => {
    return canMovePiece(piece, dice);
  });
}

function canMovePiece(piece, dice) {
  /*
   * Finished pieces cannot move.
   */

  if (piece.position === FINISHED) {
    return false;
  }

  /*
   * Piece in yard.
   * A six is required to enter.
   */

  if (piece.position === YARD) {
    return dice === 6;
  }

  /*
   * Piece already on board or home path.
   */

  const destination = getDestination(piece, dice);

  if (destination === null) {
    return false;
  }

  return true;
}

function getDestination(piece, dice) {
  if (piece.position === YARD) {
    if (dice !== 6) {
      return null;
    }

    return 0;
  }

  /*
   * Main track.
   */

  if (piece.position >= 0 && piece.position < TRACK_LENGTH) {
    const player = getPlayer(piece.playerId);

    const relativePosition =
      (piece.position - player.start + TRACK_LENGTH) %
      TRACK_LENGTH;

    const newRelativePosition = relativePosition + dice;

    /*
     * Enter home path.
     */

    if (newRelativePosition >= TRACK_LENGTH) {
      const homePosition =
        newRelativePosition - TRACK_LENGTH;

      if (homePosition > HOME_LENGTH - 1) {
        return null;
      }

      return TRACK_LENGTH + homePosition;
    }

    return (
      (player.start + newRelativePosition) %
      TRACK_LENGTH
    );
  }

  /*
   * Home path.
   */

  if (
    piece.position >= TRACK_LENGTH &&
    piece.position < FINISHED
  ) {
    const homePosition =
      piece.position - TRACK_LENGTH;

    const newHomePosition = homePosition + dice;

    if (newHomePosition > HOME_LENGTH - 1) {
      return null;
    }

    if (newHomePosition === HOME_LENGTH - 1) {
      return FINISHED;
    }

    return TRACK_LENGTH + newHomePosition;
  }

  return null;
}

/* -----------------------------
   MOVE PIECE
----------------------------- */

function movePiece(piece) {
  if (game.gameOver) return;

  const dice = game.diceValue;

  if (!dice) return;

  if (!canMovePiece(piece, dice)) {
    return;
  }

  const destination = getDestination(piece, dice);

  piece.position = destination;

  clearHighlights();

  handleCapture(piece);

  updateUI();

  if (checkWinner(piece.playerId)) {
    endGame(piece.playerId);
    return;
  }

  /*
   * Six gives another roll.
   */

  if (dice === 6) {
    gameMessage.textContent =
      `${getCurrentPlayer().name} gets another roll.`;

    game.diceValue = null;
    rollBtn.disabled = false;
  } else {
    nextTurn();
  }
}

/* -----------------------------
   CAPTURE
----------------------------- */

function handleCapture(movingPiece) {
  if (
    movingPiece.position < 0 ||
    movingPiece.position >= TRACK_LENGTH
  ) {
    return;
  }

  if (SAFE_SQUARES.has(movingPiece.position)) {
    return;
  }

  PLAYERS.forEach(player => {
    if (player.id === movingPiece.playerId) return;

    playerPieces(player.id).forEach(opponentPiece => {
      if (
        opponentPiece.position === movingPiece.position
      ) {
        opponentPiece.position = YARD;

        gameMessage.textContent =
          `${getPlayer(movingPiece.playerId).name} captured a piece!`;
      }
    });
  });
}

function playerPieces(playerId) {
  return game.pieces[playerId] || [];
}

/* -----------------------------
   TURN MANAGEMENT
----------------------------- */

function getCurrentPlayer() {
  return PLAYERS[game.currentPlayerIndex];
}

function getPlayer(playerId) {
  return PLAYERS.find(player => player.id === playerId);
}

function nextTurn() {
  if (game.gameOver) return;

  game.diceValue = null;
  game.consecutiveSixes = 0;

  game.currentPlayerIndex =
    (game.currentPlayerIndex + 1) % PLAYERS.length;

  clearHighlights();

  updateUI();

  rollBtn.disabled = false;

  gameMessage.textContent =
    `${getCurrentPlayer().name}'s turn. Roll the dice.`;
}

/* -----------------------------
   WINNER
----------------------------- */

function checkWinner(playerId) {
  const pieces = game.pieces[playerId];

  return pieces.every(
    piece => piece.position === FINISHED
  );
}

function endGame(playerId) {
  const player = getPlayer(playerId);

  game.gameOver = true;
  rollBtn.disabled = true;

  winnerTitle.textContent =
    `${player.name} Wins!`;

  winnerMessage.textContent =
    "All four pieces reached home.";

  gameScreen.classList.add("hidden");
  winnerScreen.classList.remove("hidden");
}

/* -----------------------------
   UI
----------------------------- */

function updateUI() {
  const player = getCurrentPlayer();

  turnText.textContent =
    `${player.name}'s turn`;

  updateHomeCounts();

  renderPieces();
}

function updateHomeCounts() {
  PLAYERS.forEach(player => {
    const count = game.pieces[player.id].filter(
      piece => piece.position === FINISHED
    ).length;

    const element =
      document.getElementById(
        `${player.id}-home-count`
      );

    if (element) {
      element.textContent = `${count}/4`;
    }
  });
}

/* -----------------------------
   PIECE RENDERING
----------------------------- */

function renderPieces() {
  /*
   * Remove old pieces.
   */

  document.querySelectorAll(".piece").forEach(piece => {
    piece.remove();
  });

  /*
   * Render each piece.
   */

  PLAYERS.forEach(player => {
    playerPieces(player.id).forEach(piece => {
      const element = document.createElement("div");

      element.classList.add(
        "piece",
        player.colorClass
      );

      element.dataset.pieceId = piece.id;

      /*
       * Only pieces on the logical track
       * are currently rendered on the board.
       */

      if (
        piece.position >= 0 &&
        piece.position < TRACK_LENGTH
      ) {
        const coordinate =
          getCoordinateFromTrackPosition(piece.position);

        if (coordinate) {
          const cell = getCell(
            coordinate.row,
            coordinate.col
          );

          if (cell) {
            cell.appendChild(element);
          }
        }
      }

      element.addEventListener("click", () => {
        if (
          player.id === getCurrentPlayer().id &&
          game.diceValue &&
          canMovePiece(piece, game.diceValue)
        ) {
          movePiece(piece);
        }
      });
    });
  });
}

function getCoordinateFromTrackPosition(position) {
  const coordinates = [];

  /*
   * Outer route.
   * This will be replaced with the final
   * official Ludo coordinate map.
   */

  for (let c = 6; c <= 8; c++) {
    coordinates.push({ row: 6, col: c });
  }

  for (let r = 7; r <= 13; r++) {
    coordinates.push({ row: r, col: 8 });
  }

  for (let c = 7; c >= 1; c--) {
    coordinates.push({ row: 13, col: c });
  }

  for (let r = 12; r >= 1; r--) {
    coordinates.push({ row: r, col: 1 });
  }

  for (let c = 2; c <= 13; c++) {
    coordinates.push({ row: 1, col: c });
  }

  for (let r = 2; r <= 6; r++) {
    coordinates.push({ row: r, col: 13 });
  }

  for (let c = 12; c >= 9; c--) {
    coordinates.push({ row: 6, col: c });
  }

  return coordinates[position] || null;
}

function getCell(row, col) {
  return document.querySelector(
    `.board-cell[data-row="${row}"][data-col="${col}"]`
  );
}

/* -----------------------------
   PIECE HIGHLIGHTING
----------------------------- */

function highlightLegalPieces(pieces) {
  clearHighlights();

  pieces.forEach(piece => {
    const element =
      document.querySelector(
        `[data-piece-id="${piece.id}"]`
      );

    if (element) {
      element.classList.add("movable");
    }
  });
}

function clearHighlights() {
  document.querySelectorAll(".piece.movable").forEach(
    piece => {
      piece.classList.remove("movable");
    }
  );
}

/* -----------------------------
   BUTTON EVENTS
----------------------------- */

playLocalBtn.addEventListener("click", () => {
  startGame();
});

vsComputerBtn.addEventListener("click", () => {
  /*
   * AI will be added in a later phase.
   */

  alert(
    "Computer mode is coming in the next phase."
  );
});

settingsBtn.addEventListener("click", () => {
  alert(
    "Game settings will be added in the next phase."
  );
});

rollBtn.addEventListener("click", () => {
  rollDice();
});

backBtn.addEventListener("click", () => {
  gameScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");

  game.gameOver = true;
});

pauseBtn.addEventListener("click", () => {
  alert("Pause menu will be added later.");
});

playAgainBtn.addEventListener("click", () => {
  startGame();
});

menuBtn.addEventListener("click", () => {
  winnerScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");
});

/* -----------------------------
   INITIAL STATE
----------------------------- */

createInitialPieces();

console.log("Ludo game engine loaded successfully.");
