import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXdrKA_9cOVjkadt0vPUfZtFoSmo_urtU",
  authDomain: "chbkcasino.firebaseapp.com",
  projectId: "chbkcasino",
  storageBucket: "chbkcasino.firebasestorage.app",
  messagingSenderId: "782505372980",
  appId: "1:782505372980:web:daab84c9f8ae2367d7c961"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// LOBBY
const balanceDisplayLobby = document.getElementById('brundle-balance');
let currentBalance = 0;

// SLOT
const slotSection = document.getElementById('slot-section');
const balanceDisplaySlot = document.getElementById('slot-brundle-balance');
const btnSpinSlot = document.getElementById('btn-spin');
const betAmountInput = document.getElementById('bet-amount');
const slotMessage = document.getElementById('slot-message');
const fsMessage = document.getElementById('freespin-message');
const ptBetDisplay = document.getElementById('pt-bet-display');
const paytableContent = document.getElementById('paytable-content');
const bigWinOverlay = document.getElementById('big-win-overlay');
const bigWinAmount = document.getElementById('big-win-amount');
const winDisplayContent = document.getElementById('win-display-content');
const winDisplaySection = document.getElementById('win-display-section');
const autoSpinCountSelect = document.getElementById('auto-spin-count');
const btnAutoSpin = document.getElementById('btn-auto-spin');
const btnStopAuto = document.getElementById('btn-stop-auto');

// ROULETTE
const rouletteSection = document.getElementById('roulette-section');
const balanceDisplayRoulette = document.getElementById('roulette-brundle-balance');
const rouletteBoard = document.getElementById('roulette-board');
const btnSpinRoulette = document.getElementById('btn-spin-roulette');
const btnClearRoulette = document.getElementById('btn-clear-roulette');
const btnRepeatRoulette = document.getElementById('btn-repeat-roulette');
const rouletteMessage = document.getElementById('roulette-message');
const wheelEl = document.getElementById('roulette-wheel');
const winnerTextEl = document.getElementById('roulette-winner-text');
const historyEl = document.getElementById('roulette-history');

let freeSpins = 0;
let isSpinningSlot = false;
let isAutoSpinning = false;
let autoSpinsRemaining = 0;
let winLineTimer = null;

// Variables Roulette
let selectedChipValue = 10;
let rouletteBets = {}; 
let totalRouletteBet = 0;
let isRouletteSpinning = false;
let currentWheelRotation = 0;

// Répétition de mise
let lastRouletteBets = {};
let lastTotalRouletteBet = 0;

const AMERICAN_WHEEL_ORDER = ['0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1', '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2'];
const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

// --- GESTION DU SOLDE ---
function updateBalanceDisplays(amount) {
    currentBalance = amount;
    balanceDisplayLobby.textContent = currentBalance;
    balanceDisplaySlot.textContent = currentBalance;
    balanceDisplayRoulette.textContent = currentBalance;
}

// --- MOTEUR AUDIO ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.body.addEventListener('click', initAudio, { once: true });

function playSound(type) {
    if(!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if (type === 'spin') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, t); osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
        gain.gain.setValueAtTime(0.02, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t); osc.stop(t + 0.05);
    } else if (type === 'stop') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
    } else if (type === 'win') {
        osc.type = 'square'; osc.frequency.setValueAtTime(300, t); osc.frequency.setValueAtTime(450, t + 0.1); osc.frequency.setValueAtTime(600, t + 0.2); osc.frequency.setValueAtTime(900, t + 0.3);
        gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
    }
}

// ==========================================
// ROULETTE LOGIC & ANIMATION
// ==========================================

function initRouletteWheel() {
    wheelEl.innerHTML = '';
    const segmentAngle = 360 / 38;
    AMERICAN_WHEEL_ORDER.forEach((num, index) => {
        let colorClass = 'pocket-black';
        if (num === '0' || num === '00') colorClass = 'pocket-green';
        else if (RED_NUMS.includes(parseInt(num))) colorClass = 'pocket-red';
        let pocket = document.createElement('div');
        pocket.className = `wheel-pocket ${colorClass}`;
        pocket.style.transform = `rotate(${index * segmentAngle}deg)`;
        pocket.textContent = num;
        wheelEl.appendChild(pocket);
    });
}

function initRouletteBoard() {
    let html = `
        <div class="zero-column">
            <div class="r-cell r-green r-0" data-bet="0">0</div>
            <div class="r-cell r-green r-00" data-bet="00">00</div>
        </div>
        <div class="main-grid">
    `;
    
    for (let col = 1; col <= 12; col++) {
        const n3 = col * 3; const n2 = col * 3 - 1; const n1 = col * 3 - 2;
        
        const getTargets = (n, r, c) => {
            let t = '';
            if (r > 1) t += `<div class="bet-target split-v" data-bet="${n},${n+1}"></div>`;
            if (c < 12) t += `<div class="bet-target split-h" data-bet="${n},${n+3}"></div>`;
            if (r > 1 && c < 12) t += `<div class="bet-target corner" data-bet="${n},${n+1},${n+3},${n+4}"></div>`;
            return t;
        };

        html += `<div class="r-cell ${RED_NUMS.includes(n3) ? 'r-red' : 'r-black'}" style="grid-row: 1; grid-column: ${col};" data-bet="${n3}">${n3}${getTargets(n3, 1, col)}</div>`;
        html += `<div class="r-cell ${RED_NUMS.includes(n2) ? 'r-red' : 'r-black'}" style="grid-row: 2; grid-column: ${col};" data-bet="${n2}">${n2}${getTargets(n2, 2, col)}</div>`;
        html += `<div class="r-cell ${RED_NUMS.includes(n1) ? 'r-red' : 'r-black'}" style="grid-row: 3; grid-column: ${col};" data-bet="${n1}">${n1}${getTargets(n1, 3, col)}</div>`;
    }

    html += `
            <div class="r-cell r-special r-1st12" data-bet="1st12">1st 12</div>
            <div class="r-cell r-special r-2nd12" data-bet="2nd12">2nd 12</div>
            <div class="r-cell r-special r-3rd12" data-bet="3rd12">3rd 12</div>
            <div class="r-cell r-special r-1to18" data-bet="1to18">1 to 18</div>
            <div class="r-cell r-special r-even" data-bet="even">EVEN</div>
            <div class="r-cell r-red-bet" data-bet="red">RED</div>
            <div class="r-cell r-black-bet" data-bet="black">BLACK</div>
            <div class="r-cell r-special r-odd" data-bet="odd">ODD</div>
            <div class="r-cell r-special r-19to36" data-bet="19to36">19 to 36</div>
        </div>
    `;
    rouletteBoard.innerHTML = html;

    rouletteBoard.addEventListener('click', handleBet);
    rouletteBoard.addEventListener('contextmenu', (e) => {
        e.preventDefault(); 
        handleBet(e, true);
    });
}

function handleBet(e, isRemoving = false) {
    if (isRouletteSpinning) return;
    const target = e.target.closest('[data-bet]');
    if (!target) return;
    
    initAudio();
    const betType = target.dataset.bet;
    
    if (isRemoving) {
        if (!rouletteBets[betType] || rouletteBets[betType] <= 0) return; 
        
        let amountToRemove = Math.min(selectedChipValue, rouletteBets[betType]);
        rouletteBets[betType] -= amountToRemove;
        totalRouletteBet -= amountToRemove;
        updateBalanceDisplays(currentBalance + amountToRemove);
        
        if (rouletteBets[betType] <= 0) {
            delete rouletteBets[betType];
            let chip = target.querySelector('.placed-chip');
            if(chip) chip.remove();
        } else {
            target.querySelector('.placed-chip').textContent = formatChipValue(rouletteBets[betType]);
        }
        playSound('spin');
    } else {
        if (currentBalance < selectedChipValue) {
            rouletteMessage.textContent = "Fonds insuffisants !";
            rouletteMessage.style.color = "#e74c3c";
            return;
        }

        if (!rouletteBets[betType]) rouletteBets[betType] = 0;
        rouletteBets[betType] += selectedChipValue;
        totalRouletteBet += selectedChipValue;
        updateBalanceDisplays(currentBalance - selectedChipValue);
        
        let chipEl = target.querySelector('.placed-chip');
        if (!chipEl) {
            chipEl = document.createElement('div');
            chipEl.className = 'placed-chip';
            target.appendChild(chipEl);
        }
        chipEl.textContent = formatChipValue(rouletteBets[betType]);
        playSound('spin');
    }
    
    updateRouletteSpinButton();
    rouletteMessage.textContent = "Faites vos jeux... (Clic Droit pour retirer)";
    rouletteMessage.style.color = "#aaa";
}

function formatChipValue(val) { return val >= 1000 ? (val/1000) + 'k' : val; }

function updateRouletteSpinButton() {
    btnSpinRoulette.innerHTML = `LANCER LA BILLE ! <br><span style="font-size:0.7em;">(Mise : ${totalRouletteBet})</span>`;
    btnClearRoulette.textContent = `Annuler (${totalRouletteBet})`;
}

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        selectedChipValue = parseInt(e.target.dataset.val);
    });
});

btnClearRoulette.addEventListener('click', () => {
    if (isRouletteSpinning || totalRouletteBet === 0) return;
    updateBalanceDisplays(currentBalance + totalRouletteBet);
    rouletteBets = {}; totalRouletteBet = 0; updateRouletteSpinButton();
    document.querySelectorAll('.placed-chip').forEach(c => c.remove());
    rouletteMessage.textContent = "Paris annulés.";
});

btnRepeatRoulette.addEventListener('click', () => {
    if (isRouletteSpinning || lastTotalRouletteBet === 0) return;
    initAudio();
    
    // Rembourser ce qui est posé pour éviter le double débit
    if (totalRouletteBet > 0) {
        updateBalanceDisplays(currentBalance + totalRouletteBet);
        rouletteBets = {};
        totalRouletteBet = 0;
        document.querySelectorAll('.placed-chip').forEach(c => c.remove());
    }

    if (currentBalance < lastTotalRouletteBet) {
        rouletteMessage.textContent = "Fonds insuffisants pour répéter la mise !";
        rouletteMessage.style.color = "#e74c3c";
        return;
    }

    rouletteBets = { ...lastRouletteBets };
    totalRouletteBet = lastTotalRouletteBet;
    updateBalanceDisplays(currentBalance - totalRouletteBet);
    
    for (const [betType, amount] of Object.entries(rouletteBets)) {
        const target = document.querySelector(`[data-bet="${betType}"]`);
        if (target) {
            let chipEl = target.querySelector('.placed-chip');
            if (!chipEl) {
                chipEl = document.createElement('div');
                chipEl.className = 'placed-chip';
                target.appendChild(chipEl);
            }
            chipEl.textContent = formatChipValue(amount);
        }
    }
    
    updateRouletteSpinButton();
    rouletteMessage.textContent = "Mise répétée !";
    rouletteMessage.style.color = "#aaa";
    playSound('spin');
});

btnSpinRoulette.addEventListener('click', async () => {
    initAudio();
    if (isRouletteSpinning) return;
    if (totalRouletteBet === 0) {
        rouletteMessage.textContent = "Placez au moins une mise !";
        rouletteMessage.style.color = "#f1c40f";
        return;
    }

    isRouletteSpinning = true;
    btnSpinRoulette.disabled = true; btnClearRoulette.disabled = true; btnRepeatRoulette.disabled = true;
    rouletteMessage.textContent = "Rien ne va plus !"; rouletteMessage.style.color = "#fff";
    winnerTextEl.textContent = "";

    // Sauvegarde pour le bouton répéter
    lastRouletteBets = { ...rouletteBets };
    lastTotalRouletteBet = totalRouletteBet;

    let rng = Math.floor(Math.random() * 38);
    let winningString = rng === 37 ? '00' : rng.toString();
    
    const segmentAngle = 360 / 38;
    const winningIndex = AMERICAN_WHEEL_ORDER.indexOf(winningString);
    const targetRotation = currentWheelRotation + (360 * 5) - (currentWheelRotation % 360) - (winningIndex * segmentAngle);
    currentWheelRotation = targetRotation;
    
    wheelEl.style.transform = `rotate(${currentWheelRotation}deg)`;

    setTimeout(() => { finishRouletteSpin(winningString); }, 5100);
});

async function finishRouletteSpin(winningString) {
    const user = auth.currentUser;
    winnerTextEl.textContent = winningString;
    
    let isGreen = winningString === '0' || winningString === '00';
    let isRed = !isGreen && RED_NUMS.includes(parseInt(winningString));
    
    if (isGreen) winnerTextEl.style.color = "#2ecc71";
    else if (isRed) winnerTextEl.style.color = "#e74c3c";
    else winnerTextEl.style.color = "#bdc3c7"; 

    const histItem = document.createElement('div');
    histItem.className = `hist-item ${isGreen ? 'pocket-green' : (isRed ? 'pocket-red' : 'pocket-black')}`;
    histItem.textContent = winningString;
    historyEl.prepend(histItem);
    if(historyEl.children.length > 10) historyEl.lastChild.remove();

    playSound('stop');

    let winAmount = 0;
    let winNum = parseInt(winningString);

    for (const [betType, amount] of Object.entries(rouletteBets)) {
        if (betType.includes(',')) {
            const nums = betType.split(',');
            if (nums.includes(winningString)) {
                if (nums.length === 2) winAmount += amount * 18;
                if (nums.length === 4) winAmount += amount * 9;
            }
        } else {
            if (betType === winningString) winAmount += amount * 36; 
            
            if (!isGreen) {
                if (betType === 'red' && isRed) winAmount += amount * 2;
                if (betType === 'black' && !isRed) winAmount += amount * 2;
                if (betType === 'even' && winNum % 2 === 0) winAmount += amount * 2;
                if (betType === 'odd' && winNum % 2 !== 0) winAmount += amount * 2;
                if (betType === '1to18' && winNum >= 1 && winNum <= 18) winAmount += amount * 2;
                if (betType === '19to36' && winNum >= 19 && winNum <= 36) winAmount += amount * 2;
                
                if (betType === '1st12' && winNum >= 1 && winNum <= 12) winAmount += amount * 3;
                if (betType === '2nd12' && winNum >= 13 && winNum <= 24) winAmount += amount * 3;
                if (betType === '3rd12' && winNum >= 25 && winNum <= 36) winAmount += amount * 3;
            }
        }
    }

    if (winAmount > 0) {
        playSound('win');
        rouletteMessage.textContent = `GAGNÉ ! +${winAmount} Brundles !`;
        rouletteMessage.style.color = "#2ecc71";
        updateBalanceDisplays(currentBalance + winAmount);
    } else {
        rouletteMessage.textContent = "Perdu... Retentez votre chance !";
        rouletteMessage.style.color = "#e74c3c";
    }

    await updateDoc(doc(db, "users", user.uid), { balance: currentBalance });

    rouletteBets = {}; totalRouletteBet = 0; updateRouletteSpinButton();
    document.querySelectorAll('.placed-chip').forEach(c => c.remove());
    isRouletteSpinning = false; btnSpinRoulette.disabled = false; btnClearRoulette.disabled = false; btnRepeatRoulette.disabled = false;
}

// ==========================================
// SLOT MACHINE LOGIC
// ==========================================
const PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 2, 2, 2, 1], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1],
    [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2], [0, 1, 2, 2, 2], [2, 1, 0, 0, 0], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0] 
];

const SYM_CONFIG = {
    cherry:  { file: 'slot_cherry.png',  payout: [0.1, 0.3, 1] },
    lemon:   { file: 'slot_lemon.png',   payout: [0.1, 0.3, 1] },
    orange:  { file: 'slot_orange.png',  payout: [0.2, 0.5, 2] },
    grapes:  { file: 'slot_grapes.png',  payout: [0.2, 0.5, 2] },
    prunes:  { file: 'slot_prunes.png',  payout: [0.3, 0.8, 4] },
    star:    { file: 'slot_star.png',    payout: [0.5, 2, 10] },
    bell:    { file: 'slot_bell.png',    payout: [0.5, 2, 10] },
    diamond: { file: 'slot_diamond.png', payout: [2, 10, 50] },
    s67:     { file: 'slot_67.png',      payout: [10, 50, 200] },
    wild:    { file: 'slot_wild.png',    payout: [0, 0, 0] },
    scatter: { file: 'slot_chbk.png',    payout: [0, 0, 0] } 
};

const reelTape = [
    ...Array(20).fill('cherry'), ...Array(18).fill('lemon'), ...Array(15).fill('orange'), 
    ...Array(12).fill('grapes'), ...Array(9).fill('prunes'), ...Array(6).fill('star'),     
    ...Array(6).fill('bell'), ...Array(5).fill('diamond'), ...Array(5).fill('wild'),     
    ...Array(2).fill('s67'), ...Array(2).fill('scatter')
];

function updatePaytable() {
    let bet = parseInt(betAmountInput.value);
    if(isNaN(bet) || bet < 1) bet = 1;
    ptBetDisplay.textContent = bet;
    let html = '';
    const displayOrder = ['s67', 'diamond', 'star', 'bell', 'grapes', 'prunes', 'cherry', 'lemon', 'orange'];
    displayOrder.forEach(sym => {
        const p = SYM_CONFIG[sym].payout;
        html += `<div class="paytable-row"><img src="slot_symbols/${SYM_CONFIG[sym].file}" class="paytable-sym"><span class="paytable-vals">5x: <b>${Math.max(1, Math.floor(p[2]*bet))}</b> | 4x: <b>${Math.max(1, Math.floor(p[1]*bet))}</b> | 3x: <b>${Math.max(1, Math.floor(p[0]*bet))}</b></span></div>`;
    });
    paytableContent.innerHTML = html;
}

document.querySelectorAll('.btn-bet').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (isSpinningSlot) return;
        let bet = parseInt(betAmountInput.value) || 0;
        const val = e.target.dataset.val;
        if (val === '/2') bet = Math.floor(bet / 2); else if (val === 'x2') bet *= 2; else bet += parseInt(val);
        if (bet < 1) bet = 1; betAmountInput.value = bet; updatePaytable();
    });
});
betAmountInput.addEventListener('input', updatePaytable);

function initReels() {
    for(let col = 0; col < 5; col++) {
        let html = '';
        for(let row = 0; row < 3; row++) {
            const sym = reelTape[Math.floor(Math.random() * reelTape.length)];
            html += `<div class="symbol" id="sym-${col}-${row}"><img src="slot_symbols/${SYM_CONFIG[sym].file}"></div>`;
        }
        document.getElementById(`strip-${col}`).innerHTML = html;
    }
}

// --- FIREBASE GLOBAL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('casino-section').classList.remove('hidden');
        document.getElementById('player-name').textContent = user.displayName;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { name: user.displayName, balance: 0, lastClaimDate: null });
            updateBalanceDisplays(0);
        } else {
            updateBalanceDisplays(userSnap.data().balance);
        }
        initReels(); updatePaytable(); 
        initRouletteWheel(); initRouletteBoard(); 
    } else {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('casino-section').classList.add('hidden');
        slotSection.classList.add('hidden');
        rouletteSection.classList.add('hidden');
    }
});

// NAVIGATION
document.getElementById('btn-open-slot').addEventListener('click', () => { document.getElementById('casino-section').classList.add('hidden'); slotSection.classList.remove('hidden'); });
document.getElementById('btn-open-roulette').addEventListener('click', () => { document.getElementById('casino-section').classList.add('hidden'); rouletteSection.classList.remove('hidden'); });
document.querySelectorAll('.btn-back-lobby').forEach(btn => {
    btn.addEventListener('click', () => {
        slotSection.classList.add('hidden'); rouletteSection.classList.add('hidden');
        document.getElementById('casino-section').classList.remove('hidden'); stopAutoSpin();
    });
});

// --- SLOT LOGIC VISUALS ---
function drawWinningSymbols(symbolCoords) {
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if (el) { el.classList.remove('winning-sym'); el.classList.add('dimmed'); }
        }
    }
    symbolCoords.forEach(p => {
        const symEl = document.getElementById(`sym-${p.col}-${p.row}`);
        if(symEl) { symEl.classList.remove('dimmed'); symEl.classList.add('winning-sym'); }
    });
}

function resetSymbolsVisuals() {
    bigWinOverlay.classList.add('hidden');
    winDisplayContent.innerHTML = '<p class="empty-win-msg">En attente d\'un gain...</p>';
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if(el) { el.classList.remove('winning-sym'); el.classList.remove('dimmed'); }
        }
    }
}

// --- FONCTIONS AUTOSPIN SLOT ---
btnAutoSpin.addEventListener('click', () => {
    initAudio(); autoSpinsRemaining = parseInt(autoSpinCountSelect.value);
    isAutoSpinning = true; btnAutoSpin.classList.add('hidden'); btnStopAuto.classList.remove('hidden');
    if (!isSpinningSlot) triggerSpinSlot();
});
btnStopAuto.addEventListener('click', stopAutoSpin);
function stopAutoSpin() { isAutoSpinning = false; autoSpinsRemaining = 0; btnAutoSpin.classList.remove('hidden'); btnStopAuto.classList.add('hidden'); }
btnSpinSlot.addEventListener('click', () => { initAudio(); stopAutoSpin(); if (!isSpinningSlot) triggerSpinSlot(); });

// --- MOTEUR SLOT ---
async function triggerSpinSlot() {
    if (isSpinningSlot) return;
    const user = auth.currentUser;
    let bet = parseInt(betAmountInput.value);

    if (freeSpins === 0 && (isNaN(bet) || bet <= 0 || bet > currentBalance)) {
        slotMessage.textContent = bet > currentBalance ? "Fonds insuffisants !" : "Mise invalide !";
        stopAutoSpin(); return;
    }

    isSpinningSlot = true; btnSpinSlot.disabled = true; betAmountInput.disabled = true;
    document.querySelectorAll('.btn-bet').forEach(btn => btn.disabled = true);
    
    clearTimeout(winLineTimer); resetSymbolsVisuals();

    if (freeSpins > 0) { fsMessage.textContent = `🎰 FREE SPINS : IL T'EN RESTE ${freeSpins} ! (GAINS X2)`; } 
    else { updateBalanceDisplays(currentBalance - bet); fsMessage.textContent = ""; }
    
    slotMessage.textContent = "Ça tourne..."; slotMessage.style.color = "white";

    const finalGrid = [[], [], [], [], []];
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 3; row++) finalGrid[col].push(reelTape[Math.floor(Math.random() * reelTape.length)]);
    }

    let spinTickInterval = setInterval(() => playSound('spin'), 120);

    for (let col = 0; col < 5; col++) {
        const strip = document.getElementById(`strip-${col}`);
        let oldHTML = strip.innerHTML.replace(/id="sym-\d-\d"/g, '');
        let blurCount = 15 + (col * 5); 
        let blurHTML = '';
        for(let i=0; i<blurCount; i++) blurHTML += `<div class="symbol"><img src="slot_symbols/${SYM_CONFIG[reelTape[Math.floor(Math.random() * reelTape.length)]].file}"></div>`;
        let finalHTML = '';
        for(let row=0; row<3; row++) finalHTML += `<div class="symbol" id="sym-${col}-${row}"><img src="slot_symbols/${SYM_CONFIG[finalGrid[col][row]].file}"></div>`;
        
        strip.style.transition = 'none'; strip.style.transform = `translateY(0px)`;
        strip.innerHTML = oldHTML + blurHTML + finalHTML; strip.offsetHeight; 
        const stopTime = 1.0 + (col * 0.5); 
        strip.style.transition = `transform ${stopTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        strip.style.transform = `translateY(-${(3 + blurCount) * 80}px)`;
        
        setTimeout(() => { strip.style.transition = 'none'; strip.style.transform = `translateY(0px)`; strip.innerHTML = finalHTML; playSound('stop'); }, stopTime * 1000);
    }

    setTimeout(() => clearInterval(spinTickInterval), 2900);

    setTimeout(async () => {
        let totalWin = 0; let scatterCount = 0; let allWinningPaths = []; let winGridsHTML = '';
        
        for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) if (finalGrid[c][r] === 'scatter') scatterCount++;

        PAYLINES.forEach((line, index) => {
            let firstSym = null; let matchCount = 0; let winningSymbolsCoords = [];
            for(let col = 0; col < 5; col++) {
                let row = line[col]; let sym = finalGrid[col][row];
                if (sym === 'scatter') break;
                if (firstSym === null) { if (sym !== 'wild') firstSym = sym; matchCount++; winningSymbolsCoords.push({col, row}); }
                else { if (sym === firstSym || sym === 'wild') { matchCount++; winningSymbolsCoords.push({col, row}); } else break; }
            }
            if (firstSym === null && matchCount > 0) firstSym = 's67';
            
            if (matchCount >= 3 && firstSym) {
                let realPayout = Math.floor(bet * SYM_CONFIG[firstSym].payout[matchCount - 3]);
                if (realPayout > 0) {
                    totalWin += realPayout;
                    allWinningPaths.push(winningSymbolsCoords);
                    let gridHTML = `<div class="win-line-box"><span>Gain : +${realPayout}</span><div class="mini-grid">`;
                    for(let r=0; r<3; r++) {
                        for(let c=0; c<5; c++) {
                            const isActive = winningSymbolsCoords.some(p => p.col === c && p.row === r);
                            gridHTML += `<div class="mini-dot ${isActive ? 'active' : ''}"></div>`;
                        }
                    }
                    gridHTML += `</div></div>`;
                    winGridsHTML += gridHTML;
                }
            }
        });

        if (freeSpins > 0) { totalWin *= 2; freeSpins--; }
        if (scatterCount === 3) freeSpins += 10; else if (scatterCount === 4) freeSpins += 20; else if (scatterCount === 5) freeSpins += 30;

        if (winGridsHTML !== '') winDisplayContent.innerHTML = winGridsHTML;

        if (scatterCount >= 3) {
            playSound('win'); slotMessage.textContent = `BOOM ! ${scatterCount} SCATTERS ! +${scatterCount === 3 ? 10 : (scatterCount === 4 ? 20 : 30)} FREE SPINS !`;
            slotMessage.style.color = "#f1c40f";
        } else if (totalWin > 0) {
            playSound('win');
            bigWinAmount.textContent = `+${totalWin}`; bigWinOverlay.classList.remove('hidden');
            slotMessage.textContent = `SUPER ! Gain : +${totalWin} Brundles !`; slotMessage.style.color = "#2ecc71";
            
            let pathIndex = 0;
            function showNextWinningSet() {
                if(!isSpinningSlot && allWinningPaths.length > 0) { 
                    for(let c=0; c<5; c++) {
                        for(let r=0; r<3; r++) {
                            const el = document.getElementById(`sym-${c}-${r}`);
                            if(el) { el.classList.remove('winning-sym'); el.classList.remove('dimmed'); }
                        }
                    }
                    drawWinningSymbols(allWinningPaths[pathIndex]); 
                    pathIndex = (pathIndex + 1) % allWinningPaths.length;
                    winLineTimer = setTimeout(showNextWinningSet, 1200); 
                }
            }
            showNextWinningSet();
        } else {
            slotMessage.textContent = "Retente ta chance !"; slotMessage.style.color = "#e74c3c";
        }

        updateBalanceDisplays(currentBalance + totalWin);
        await updateDoc(doc(db, "users", user.uid), { balance: currentBalance });
        
        isSpinningSlot = false; btnSpinSlot.disabled = false; betAmountInput.disabled = false;
        document.querySelectorAll('.btn-bet').forEach(btn => btn.disabled = false);
        
        if (freeSpins > 0 || isAutoSpinning) {
            if (isAutoSpinning && freeSpins === 0) autoSpinsRemaining--;
            if (isAutoSpinning && autoSpinsRemaining <= 0 && freeSpins === 0) stopAutoSpin();
            else setTimeout(triggerSpinSlot, totalWin > 0 ? 3000 : 800); 
        } else if (totalWin > 0) {
            setTimeout(() => { if(!isSpinningSlot) bigWinOverlay.classList.add('hidden'); }, 3000);
        }

    }, 3200); 
}