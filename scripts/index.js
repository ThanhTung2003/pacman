import { ethers } from 'ethers';
import {
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  BASE_CHAIN_HEX,
  BASE_RPC,
} from './contract.js';

let walletProvider = null;
let walletSigner = null;
let walletAddress = null;
let feeContract = null;
let isPlaying = false;

function setStatus(msg) {
  const statusEl = document.getElementById('transaction-status');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerText = msg;
  }
}

//board
let board;
const rowCount = 21;
const columnCount = 19;
const tileSize = 32;
const boardWidth = columnCount*tileSize;
const boardHeight = rowCount*tileSize;
let context;

let blueGhostImage;
let orangeGhostImage;
let pinkGhostImage;
let redGhostImage;
let pacmanUpImage;
let pacmanDownImage;
let pacmanLeftImage;
let pacmanRightImage;
let wallImage;

//X = wall, O = skip, P = pac man, ' ' = food
//Ghosts: b = blue, o = orange, p = pink, r = red
const tileMap = [
    "XXXXXXXXXXXXXXXXXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X                 X",
    "X XX X XXXXX X XX X",
    "X    X       X    X",
    "XXXX XXXX XXXX XXXX",
    "OOOX X       X XOOO",
    "XXXX X XXrXX X XXXX",
    "O       bpo       O",
    "XXXX X XXXXX X XXXX",
    "OOOX X       X XOOO",
    "XXXX X XXXXX X XXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X  X     P     X  X",
    "XX X X XXXXX X X XX",
    "X    X   X   X    X",
    "X XXXXXX X XXXXXX X",
    "X                 X",
    "XXXXXXXXXXXXXXXXXXX" 
];

const walls = new Set();
const foods = new Set();
const ghosts = new Set();
let pacman;

const directions = ['U', 'D', 'L', 'R']; //up down left right
let score = 0;
let lives = 3;
let gameOver = false;

window.onload = async function() {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d"); //used for drawing on the board

    await loadImages(); // Wait for all images to load before doing anything
    loadMap();
    for (let ghost of ghosts.values()) {
        const newDirection = directions[Math.floor(Math.random()*4)];
        ghost.updateDirection(newDirection);
    }

    // Draw a preview of the map (static, game not started)
    drawPreview();

    document.addEventListener("keyup", movePacman);

    // Setup mobile controls
    document.querySelectorAll('.control-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (gameOver || !isPlaying || !pacman) return;

        switch (btn.dataset.action) {
          case 'left':
            pacman.updateDirection('L');
            break;
          case 'right':
            pacman.updateDirection('R');
            break;
          case 'down':
            pacman.updateDirection('D');
            break;
          case 'up':
            pacman.updateDirection('U');
            break;
          default:
            break;
        }
        
        // update pacman images for mobile
        if (pacman.direction == 'U') {
            pacman.image = pacmanUpImage;
        }
        else if (pacman.direction == 'D') {
            pacman.image = pacmanDownImage;
        }
        else if (pacman.direction == 'L') {
            pacman.image = pacmanLeftImage;
        }
        else if (pacman.direction == 'R') {
            pacman.image = pacmanRightImage;
        }
      });
    });
}

document.getElementById('connect-wallet').addEventListener('click', async () => {
    if (!window.ethereum) {
      setStatus('MetaMask is required to play this game.');
      return;
    }
    try {
      walletProvider = new ethers.BrowserProvider(window.ethereum);
      await walletProvider.send('eth_requestAccounts', []);

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_HEX }],
        });
      } catch (err) {
        if (err.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_CHAIN_HEX,
                chainName: 'Base',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [BASE_RPC],
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
        } else {
          throw err;
        }
      }

      walletSigner = await walletProvider.getSigner();
      walletAddress = await walletSigner.getAddress();

      document.getElementById('wallet-address').style.display = 'block';
      document.getElementById('wallet-address').innerText = walletAddress;
      document.getElementById('connect-wallet').style.display = 'none';
      document.getElementById('play').style.display = 'block';

      if (
        CONTRACT_ADDRESS &&
        CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000'
      ) {
        feeContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          walletSigner,
        );
      }
    } catch (err) {
      console.error(err);
      setStatus('Failed to connect wallet. Please try again.');
    }
});

document.getElementById('play').addEventListener('click', async () => {
  if (isPlaying) return;
  
  if (feeContract) {
    try {
      setStatus('Waiting for Game Start Fee payment...');
      const fee = await feeContract.gameStartFee();
      const txReq = await feeContract.payGameStart.populateTransaction({ value: fee });
      const tx = await walletSigner.sendTransaction(txReq);
      await tx.wait();
      setStatus('Game Start Fee paid successfully! Starting game...');
    } catch (e) {
      console.error(e);
      setStatus('Game Start Fee failed or rejected!');
      return; // Do not start if fee fails
    }
  }

  isPlaying = true;
  gameOver = false;
  lives = 3;
  score = 0;
  document.getElementById('lives').innerHTML = lives;
  document.getElementById('score').innerHTML = score;
  document.getElementById('play').style.display = 'none'; // Hide play button during game
  loadMap();
  resetPositions();
  update();
});

async function handleGameOver() {
    gameOver = true;
    isPlaying = false;
    document.getElementById('play').style.display = 'block'; // Show play button again
    setStatus('GAME OVER! You can restart from the Play button.');

    if (feeContract) {
      try {
        setStatus('Waiting for Game End Fee payment...');
        const fee = await feeContract.gameEndFee();
        const txReq = await feeContract.payGameEnd.populateTransaction({ value: fee });
        const tx = await walletSigner.sendTransaction(txReq);
        await tx.wait();
        setStatus('Game End Fee paid successfully!');
      } catch (e) {
        console.error(e);
        setStatus('Game End Fee failed or rejected!');
      }
    }
}

function loadImages() {
    // Returns a Promise that resolves when all images are loaded
    const makeImg = (src) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img); // resolve even on error to not block
        img.src = src;
        return img;
    });

    return Promise.all([
        makeImg('/wall.png'),
        makeImg('/blueGhost.png'),
        makeImg('/orangeGhost.png'),
        makeImg('/pinkGhost.png'),
        makeImg('/redGhost.png'),
        makeImg('/pacmanUp.png'),
        makeImg('/pacmanDown.png'),
        makeImg('/pacmanLeft.png'),
        makeImg('/pacmanRight.png'),
    ]).then(([
        wall, blue, orange, pink, red, up, down, left, right
    ]) => {
        wallImage = wall;
        blueGhostImage = blue;
        orangeGhostImage = orange;
        pinkGhostImage = pink;
        redGhostImage = red;
        pacmanUpImage = up;
        pacmanDownImage = down;
        pacmanLeftImage = left;
        pacmanRightImage = right;
    });
}

function loadMap() {
    walls.clear();
    foods.clear();
    ghosts.clear();

    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < columnCount; c++) {
            const row = tileMap[r];
            const tileMapChar = row[c];

            const x = c*tileSize;
            const y = r*tileSize;

            if (tileMapChar == 'X') { //block wall
                const wall = new Block(wallImage, x, y, tileSize, tileSize);
                walls.add(wall);  
            }
            else if (tileMapChar == 'b') { //blue ghost
                const ghost = new Block(blueGhostImage, x, y, tileSize, tileSize);
                ghosts.add(ghost);
            }
            else if (tileMapChar == 'o') { //orange ghost
                const ghost = new Block(orangeGhostImage, x, y, tileSize, tileSize);
                ghosts.add(ghost);
            }
            else if (tileMapChar == 'p') { //pink ghost
                const ghost = new Block(pinkGhostImage, x, y, tileSize, tileSize);
                ghosts.add(ghost);
            }
            else if (tileMapChar == 'r') { //red ghost
                const ghost = new Block(redGhostImage, x, y, tileSize, tileSize);
                ghosts.add(ghost);
            }
            else if (tileMapChar == 'P') { //pacman
                pacman = new Block(pacmanRightImage, x, y, tileSize, tileSize);
            }
            else if (tileMapChar == ' ') { //empty is food
                const food = new Block(null, x + 14, y + 14, 4, 4);
                foods.add(food);
            }
        }
    }
}

function update() {
    if (gameOver || !isPlaying) {
        return;
    }
    move();
    draw();
    setTimeout(update, 50); //1000/50 = 20 FPS
}

// Draw static map preview (before game starts)
function drawPreview() {
    if (!context) return;
    context.clearRect(0, 0, board.width, board.height);

    for (let wall of walls.values()) {
        context.drawImage(wall.image, wall.x, wall.y, wall.width, wall.height);
    }
    context.fillStyle = "white";
    for (let food of foods.values()) {
        context.fillRect(food.x, food.y, food.width, food.height);
    }
    if (pacman) {
        context.drawImage(pacman.image, pacman.x, pacman.y, pacman.width, pacman.height);
    }
    for (let ghost of ghosts.values()) {
        context.drawImage(ghost.image, ghost.x, ghost.y, ghost.width, ghost.height);
    }
}

function draw() {
    if (!pacman) return;
    context.clearRect(0, 0, board.width, board.height);
    context.drawImage(pacman.image, pacman.x, pacman.y, pacman.width, pacman.height);
    for (let ghost of ghosts.values()) {
        context.drawImage(ghost.image, ghost.x, ghost.y, ghost.width, ghost.height);
    }
    
    for (let wall of walls.values()) {
        context.drawImage(wall.image, wall.x, wall.y, wall.width, wall.height);
    }

    context.fillStyle = "white";
    for (let food of foods.values()) {
        context.fillRect(food.x, food.y, food.width, food.height);
    }

    //score
    context.fillStyle = "white";
    context.font="14px sans-serif";
    if (gameOver) {
        context.fillText("Game Over: " + String(score), tileSize/2, tileSize/2);
    }
    else {
        context.fillText("x" + String(lives) + " " + String(score), tileSize/2, tileSize/2);
    }
}

function move() {
    pacman.x += pacman.velocityX;
    pacman.y += pacman.velocityY;

    //check wall collisions
    for (let wall of walls.values()) {
        if (collision(pacman, wall)) {
            pacman.x -= pacman.velocityX;
            pacman.y -= pacman.velocityY;
            break;
        }
    }

    //check ghosts collision
    for (let ghost of ghosts.values()) {
        if (collision(ghost, pacman)) {
            lives -= 1;
            document.getElementById('lives').innerHTML = lives;
            if (lives == 0) {
                handleGameOver();
                return;
            }
            resetPositions();
        }

        if (ghost.y == tileSize*9 && ghost.direction != 'U' && ghost.direction != 'D') {
            ghost.updateDirection('U');
        }

        ghost.x += ghost.velocityX;
        ghost.y += ghost.velocityY;
        for (let wall of walls.values()) {
            if (collision(ghost, wall) || ghost.x <= 0 || ghost.x + ghost.width >= boardWidth) {
                ghost.x -= ghost.velocityX;
                ghost.y -= ghost.velocityY;
                const newDirection = directions[Math.floor(Math.random()*4)];
                ghost.updateDirection(newDirection);
            }
        }
    }

    //check food collision
    let foodEaten = null;
    for (let food of foods.values()) {
        if (collision(pacman, food)) {
            foodEaten = food;
            score += 10;
            document.getElementById('score').innerHTML = score;
            break;
        }
    }
    foods.delete(foodEaten);

    //next level
    if (foods.size == 0) {
        loadMap();
        resetPositions();
    }
}

function movePacman(e) {
    if (gameOver || !isPlaying) {
        return;
    }

    if (e.code == "ArrowUp" || e.code == "KeyW") {
        pacman.updateDirection('U');
    }
    else if (e.code == "ArrowDown" || e.code == "KeyS") {
        pacman.updateDirection('D');
    }
    else if (e.code == "ArrowLeft" || e.code == "KeyA") {
        pacman.updateDirection('L');
    }
    else if (e.code == "ArrowRight" || e.code == "KeyD") {
        pacman.updateDirection('R');
    }

    //update pacman images
    if (pacman.direction == 'U') {
        pacman.image = pacmanUpImage;
    }
    else if (pacman.direction == 'D') {
        pacman.image = pacmanDownImage;
    }
    else if (pacman.direction == 'L') {
        pacman.image = pacmanLeftImage;
    }
    else if (pacman.direction == 'R') {
        pacman.image = pacmanRightImage;
    }
    
}

function collision(a, b) {
    return a.x < b.x + b.width &&   //a's top left corner doesn't reach b's top right corner
           a.x + a.width > b.x &&   //a's top right corner passes b's top left corner
           a.y < b.y + b.height &&  //a's top left corner doesn't reach b's bottom left corner
           a.y + a.height > b.y;    //a's bottom left corner passes b's top left corner
}

function resetPositions() {
    pacman.reset();
    pacman.velocityX = 0;
    pacman.velocityY = 0;
    for (let ghost of ghosts.values()) {
        ghost.reset();
        const newDirection = directions[Math.floor(Math.random()*4)];
        ghost.updateDirection(newDirection);
    }
}

class Block {
    constructor(image, x, y, width, height) {
        this.image = image;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.startX = x;
        this.startY = y;

        this.direction = 'R';
        this.velocityX = 0;
        this.velocityY = 0;
    }

    updateDirection(direction) {
        const prevDirection = this.direction;
        this.direction = direction;
        this.updateVelocity();
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        for (let wall of walls.values()) {
            if (collision(this, wall)) {
                this.x -= this.velocityX;
                this.y -= this.velocityY;
                this.direction = prevDirection;
                this.updateVelocity();
                return;
            }
        }
    }

    updateVelocity() {
        if (this.direction == 'U') {
            this.velocityX = 0;
            this.velocityY = -tileSize/4;
        }
        else if (this.direction == 'D') {
            this.velocityX = 0;
            this.velocityY = tileSize/4;
        }
        else if (this.direction == 'L') {
            this.velocityX = -tileSize/4;
            this.velocityY = 0;
        }
        else if (this.direction == 'R') {
            this.velocityX = tileSize/4;
            this.velocityY = 0;
        }
    }

    reset() {
        this.x = this.startX;
        this.y = this.startY;
    }
};
