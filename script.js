
"use strict";

// ==========================================
// GLOBAL DATA
// ==========================================

let students = [];
let vocabulary = [];
let remainingStudents = [];

let selectedGuessWords = [];
let guessMeaningsVisible = false;

// Matching game state
let matchWords = [];
let matchMeanings = [];
let matchPairs = {};

let selectedWordIndex = null;
let matchChecked = false;

const $ = id => document.getElementById(id);

const studentResult = $("studentResult");
const studentButton = $("studentButton");
const studentCount = $("studentCount");

const gameMode = $("gameMode");

const guessGame = $("guessGame");
const matchGame = $("matchGame");

const wordResults = $("wordResults");
const vocabularyButton = $("vocabularyButton");
const meaningButton = $("meaningButton");

const englishWords = $("englishWords");
const chineseMeanings = $("chineseMeanings");

const matchBoard = $("matchBoard");
const matchLines = $("matchLines");

const newMatchButton = $("newMatchButton");
const checkMatchButton = $("checkMatchButton");

const matchProgress = $("matchProgress");
const matchHint = $("matchHint");
const matchResult = $("matchResult");


// ==========================================
// LOAD EXTERNAL FILES
// ==========================================

async function loadData() {

    try {

        const [studentResponse, vocabularyResponse] =
            await Promise.all([
                fetch("./students.txt"),
                fetch("./vocabulary.csv")
            ]);

        if (!studentResponse.ok) {
            throw new Error(
                "Cannot load students.txt. Check the filename and folder."
            );
        }

        if (!vocabularyResponse.ok) {
            throw new Error(
                "Cannot load vocabulary.csv. Check the filename and folder."
            );
        }

        const studentText = await studentResponse.text();
        const vocabularyText = await vocabularyResponse.text();

        // Parse student names

        students = studentText
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .map(name => name.trim())
            .filter(Boolean);

        remainingStudents = [...students];

        // Parse vocabulary

        vocabulary = parseCSV(vocabularyText);

        if (students.length === 0) {
            throw new Error("The student list is empty.");
        }

        if (vocabulary.length < 5) {
            throw new Error(
                "The vocabulary list needs at least five words."
            );
        }

        studentButton.disabled = false;
        vocabularyButton.disabled = false;
        newMatchButton.disabled = false;

        studentCount.textContent =
            students.length + " students loaded";

        studentResult.querySelector("span").textContent =
            "Ready!";

        // Prepare initial games

        startGuessGame();
        startMatchGame();

        console.log("Students loaded:", students.length);
        console.log("Vocabulary loaded:", vocabulary.length);

    } catch (error) {

        console.error("Loading error:", error);

        studentResult.querySelector("span").textContent =
            "Loading failed";

        studentCount.textContent = error.message;

        $("wordResults").textContent = error.message;

        matchResult.textContent = error.message;

        studentButton.disabled = true;
        vocabularyButton.disabled = true;
        newMatchButton.disabled = true;
    }
}


// ==========================================
// CSV PARSER
// Supports quoted fields and commas
// ==========================================

function parseCSV(text) {

    const rows = [];

    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {

        const char = text[i];

        if (char === '"') {

            if (insideQuotes && text[i + 1] === '"') {
                field += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }

        } else if (char === "," && !insideQuotes) {

            row.push(field.trim());
            field = "";

        } else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (char === "\r" && text[i + 1] === "\n") {
                i++;
            }

            row.push(field.trim());

            if (row.some(value => value !== "")) {
                rows.push(row);
            }

            row = [];
            field = "";

        } else {

            field += char;
        }
    }

    row.push(field.trim());

    if (row.some(value => value !== "")) {
        rows.push(row);
    }

    if (rows.length < 2) {
        throw new Error("Vocabulary file has no data.");
    }

    const headers = rows[0].map(header =>
        header.replace(/^\uFEFF/, "").trim().toLowerCase()
    );

    const wordIndex = headers.indexOf("words");
    const meaningIndex = headers.indexOf("meanings");

    if (wordIndex === -1 || meaningIndex === -1) {
        throw new Error(
            'CSV must contain "words" and "meanings" columns.'
        );
    }

    return rows.slice(1)
        .map(row => ({
            word: row[wordIndex] || "",
            meaning: row[meaningIndex] || ""
        }))
        .filter(item => item.word && item.meaning);
}


// ==========================================
// RANDOM SHUFFLE
// ==========================================

function shuffle(array) {

    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [result[i], result[j]] =
            [result[j], result[i]];
    }

    return result;
}


// ==========================================
// STUDENT PICKER
// No repeats until everyone is selected
// ==========================================

studentButton.addEventListener("click", function () {

    if (remainingStudents.length === 0) {
        remainingStudents = shuffle(students);
    }

    const randomIndex = Math.floor(
        Math.random() * remainingStudents.length
    );

    const selectedStudent = remainingStudents.splice(
        randomIndex, 1
    )[0];

    const result = studentResult.querySelector("span");

    result.textContent = selectedStudent;

    result.animate(
        [
            { opacity: 0, transform: "scale(0.7)" },
            { opacity: 1, transform: "scale(1)" }
        ],
        {
            duration: 350,
            easing: "ease-out"
        }
    );
});


// ==========================================
// GAME MODE DROPDOWN
// ==========================================

gameMode.addEventListener("change", function () {

    if (gameMode.value === "guess") {

        guessGame.hidden = false;
        matchGame.hidden = true;

    } else {

        guessGame.hidden = true;
        matchGame.hidden = false;

        // Redraw lines when matching game becomes visible
        requestAnimationFrame(drawMatchLines);
    }

});


// ==========================================
// GAME 1: GUESS THREE WORDS
// ==========================================

function startGuessGame() {

    selectedGuessWords = shuffle(vocabulary).slice(0, 3);

    guessMeaningsVisible = false;

    meaningButton.disabled = false;
    meaningButton.textContent = "Show Meanings";

    displayGuessWords();
}


function displayGuessWords() {

    wordResults.innerHTML = "";

    selectedGuessWords.forEach((item, index) => {

        const card = document.createElement("div");
        card.className = "guess-card";

        const number = document.createElement("span");
        number.className = "word-number";
        number.textContent =
            String(index + 1).padStart(2, "0");

        const word = document.createElement("span");
        word.className = "guess-word";
        word.textContent = item.word;

        const meaning = document.createElement("span");
        meaning.className = "guess-meaning";

        meaning.textContent = guessMeaningsVisible
            ? item.meaning
            : "";

        card.append(number, word, meaning);

        wordResults.appendChild(card);
    });
}


vocabularyButton.addEventListener("click", function () {

    startGuessGame();

});


meaningButton.addEventListener("click", function () {

    if (selectedGuessWords.length === 0) return;

    guessMeaningsVisible = !guessMeaningsVisible;

    meaningButton.textContent = guessMeaningsVisible
        ? "Hide Meanings"
        : "Show Meanings";

    displayGuessWords();
});


// ==========================================
// GAME 2: MATCHING GAME
// ==========================================

function startMatchGame() {

    if (vocabulary.length < 5) return;

    // Select five new vocabulary entries
    matchWords = shuffle(vocabulary).slice(0, 5);

    // Shuffle meanings independently
    matchMeanings = shuffle(matchWords);

    // Reset matching data
    matchPairs = {};
    selectedWordIndex = null;
    matchChecked = false;

    // Reset button
    checkMatchButton.textContent = "Check Answers";
    checkMatchButton.disabled = true;

    // Reset messages
    matchResult.textContent =
        "Match each English word with its Chinese meaning!";

    matchResult.className = "match-result";

    matchHint.textContent =
        "Select a word to begin.";

    // Display new words
    renderMatchItems();

    updateMatchProgress();

    requestAnimationFrame(drawMatchLines);
}


// ==========================================
// DISPLAY MATCHING ITEMS
// ==========================================

function renderMatchItems() {

    englishWords.innerHTML = "";
    chineseMeanings.innerHTML = "";

    // English words on the left
    matchWords.forEach((item, index) => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "match-item";
        button.textContent = item.word;

        button.dataset.index = index;

        button.classList.toggle(
            "selected",
            selectedWordIndex === index
        );

        button.classList.toggle(
            "matched",
            Object.hasOwn(matchPairs, index)
        );

        button.disabled = matchChecked;

        button.addEventListener("click", function () {
            selectMatchWord(index);
        });

        englishWords.appendChild(button);
    });


    // Chinese meanings on the right
    matchMeanings.forEach((item, index) => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "match-item";
        button.textContent = item.meaning;

        button.dataset.index = index;

        const isMatched = Object.values(matchPairs)
            .includes(index);

        button.classList.toggle("matched", isMatched);

        button.disabled = matchChecked;

        button.addEventListener("click", function () {
            selectMatchMeaning(index);
        });

        chineseMeanings.appendChild(button);
    });

}


// ==========================================
// SELECT AN ENGLISH WORD
// ==========================================

function selectMatchWord(index) {

    if (matchChecked) return;

    selectedWordIndex = index;

    matchHint.textContent =
        "Now select the correct Chinese meaning.";

    renderMatchItems();

}


// ==========================================
// SELECT A CHINESE MEANING
// ==========================================

function selectMatchMeaning(meaningIndex) {

    if (matchChecked) return;

    if (selectedWordIndex === null) {

        matchHint.textContent =
            "Please select an English word first.";

        return;
    }

    // Remove the old connection for this word
    delete matchPairs[selectedWordIndex];

    // If the meaning is already connected to another word,
    // remove that previous connection too.
    for (const [wordIndex, existingMeaning] of
        Object.entries(matchPairs)) {

        if (existingMeaning === meaningIndex) {
            delete matchPairs[wordIndex];
        }
    }

    // Connect the selected word and meaning
    matchPairs[selectedWordIndex] = meaningIndex;

    selectedWordIndex = null;

    matchHint.textContent =
        "Good! Select the next English word.";

    matchResult.textContent =
        "Keep matching the remaining words.";

    matchResult.className = "match-result";

    renderMatchItems();

    updateMatchProgress();

    requestAnimationFrame(drawMatchLines);
}


// ==========================================
// UPDATE MATCHING PROGRESS
// ==========================================

function updateMatchProgress() {

    const total = Object.keys(matchPairs).length;

    matchProgress.textContent =
        "Matched: " + total + " / 5";

    checkMatchButton.disabled = total !== 5;

}


// ==========================================
// DRAW CONNECTION LINES
// ==========================================

function drawMatchLines() {

    matchLines.innerHTML = "";

    if (!matchWords.length || matchGame.hidden) return;

    const boardRect = matchBoard.getBoundingClientRect();

    if (!boardRect.width || !boardRect.height) return;

    matchLines.setAttribute(
        "viewBox",
        `0 0 ${boardRect.width} ${boardRect.height}`
    );

    for (const [wordIndex, meaningIndex] of
        Object.entries(matchPairs)) {

        const wordButton = englishWords.querySelector(
            `[data-index="${wordIndex}"]`
        );

        const meaningButton = chineseMeanings.querySelector(
            `[data-index="${meaningIndex}"]`
        );

        if (!wordButton || !meaningButton) continue;

        const wordRect = wordButton.getBoundingClientRect();
        const meaningRect = meaningButton.getBoundingClientRect();

        const x1 = wordRect.right - boardRect.left;
        const y1 = wordRect.top + wordRect.height / 2
            - boardRect.top;

        const x2 = meaningRect.left - boardRect.left;
        const y2 = meaningRect.top + meaningRect.height / 2
            - boardRect.top;

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );

        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);

        line.classList.add("match-line");

        if (matchChecked) {

            const correct =
                matchWords[Number(wordIndex)].word ===
                matchMeanings[meaningIndex].word;

            line.classList.add(
                correct ? "correct" : "incorrect"
            );
        }

        matchLines.appendChild(line);
    }
}


// ==========================================
// CHECK ANSWERS / MATCH AGAIN
// ==========================================

checkMatchButton.addEventListener("click", function () {

    // If answers have already been checked,
    // restart the current round using the same words.
    if (matchChecked) {

        matchPairs = {};

        selectedWordIndex = null;

        matchChecked = false;

        checkMatchButton.textContent = "Check Answers";

        matchResult.textContent =
            "Match the five words again!";

        matchResult.className = "match-result";

        matchHint.textContent =
            "Select a word to begin.";

        renderMatchItems();

        updateMatchProgress();

        requestAnimationFrame(drawMatchLines);

        return;
    }

    // Only check when all five pairs are completed
    if (Object.keys(matchPairs).length !== 5) {
        return;
    }

    matchChecked = true;

    let correctCount = 0;

    // Check every connection
    for (const [wordIndex, meaningIndex] of
        Object.entries(matchPairs)) {

        const correct =
            matchWords[Number(wordIndex)].word ===
            matchMeanings[meaningIndex].word;

        if (correct) {
            correctCount++;
        }
    }

    // Render checked items
    renderMatchItems();

    // Display individual feedback
    for (const [wordIndex, meaningIndex] of
        Object.entries(matchPairs)) {

        const correct =
            matchWords[Number(wordIndex)].word ===
            matchMeanings[meaningIndex].word;

        const wordButton = englishWords.querySelector(
            `[data-index="${wordIndex}"]`
        );

        const meaningButton = chineseMeanings.querySelector(
            `[data-index="${meaningIndex}"]`
        );

        if (correct) {

            wordButton.classList.add("correct");
            meaningButton.classList.add("correct");

            wordButton.textContent += " 😊";

        } else {

            wordButton.classList.add("incorrect");
            meaningButton.classList.add("incorrect");

            wordButton.textContent += " 😢";
        }
    }

    // Display score
    if (correctCount === 5) {

        matchResult.textContent =
            "🎉 Excellent! 5 / 5 correct! 😊";

        matchResult.className =
            "match-result success";

    } else {

        matchResult.textContent =
            `You got ${correctCount} out of 5 correct! ` +
            "Keep practising!";

        matchResult.className =
            "match-result partial";
    }

    matchHint.textContent = "Round completed!";

    // Change button to Match Again
    checkMatchButton.textContent = "Match Again";

    // Keep button enabled so students can replay
    checkMatchButton.disabled = false;

    requestAnimationFrame(drawMatchLines);

});


// ==========================================
// NEW MATCHING ROUND
// ==========================================

newMatchButton.addEventListener("click", function () {

    startMatchGame();

});


// ==========================================
// REDRAW LINES WHEN WINDOW SIZE CHANGES
// ==========================================

window.addEventListener("resize", function () {

    requestAnimationFrame(drawMatchLines);

});


// ==========================================
// INITIALIZE
// ==========================================

studentButton.disabled = true;
vocabularyButton.disabled = true;
newMatchButton.disabled = true;
checkMatchButton.disabled = true;

meaningButton.disabled = true;

loadData();
