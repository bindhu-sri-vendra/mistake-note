// ---------- Tab switching ----------
const tabs = document.querySelectorAll(".tab");
const screens = document.querySelectorAll(".screen");

function showScreen(name) {
  // show only the screen we want
  screens.forEach(function (screen) {
    screen.classList.toggle("active", screen.id === "screen-" + name);
  });
  // highlight the matching tab
  tabs.forEach(function (tab) {
    tab.classList.toggle("active", tab.dataset.screen === name);
  });
}

// when a tab is clicked, show its screen
tabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    showScreen(tab.dataset.screen);
  });
});

// start on the Today screen
showScreen("today");

// ---------- Data: settings ----------
const STORAGE_KEY = "mistakeNoteData";
const INTERVALS = [1, 3, 7, 14, 30]; // days between reviews (used in Step 6)

// ---------- Data: date helpers ----------
// Dates are stored like "2026-11-20" (year-month-day), which is easy to compare.
// We show them as "20 November 2026" later, in Step 8.
function pad(n) {
  return String(n).padStart(2, "0");
}

function dateToString(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function todayString() {
  return dateToString(new Date());
}

// add (or subtract) days from a date string, e.g. addDays("2026-11-20", 3)
function addDays(dateStr, days) {
  const parts = dateStr.split("-").map(Number);
  return dateToString(new Date(parts[0], parts[1] - 1, parts[2] + days));
}

// ---------- Data: load and save ----------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.cards)) return data;
    return null;
  } catch (error) {
    console.log("Could not load data:", error);
    return null;
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (error) {
    console.log("Could not save data:", error);
  }
}

// ---------- Data: sample cards ----------
// box = -1 means "never revised". status is New, In progress or Mastered.
function makeSampleCards() {
  const today = todayString();
  const ago = function (n) { return addDays(today, -n); };

  return [
    {
      id: "sample-1", sample: true, type: "vocab",
      word: "약속", meaning: "appointment, promise",
      example: "친구와 약속이 있어요.", note: "",
      dateAdded: ago(6), status: "New", box: -1, nextReview: ago(6), history: []
    },
    {
      id: "sample-2", sample: true, type: "vocab",
      word: "익숙하다", meaning: "to be familiar, used to",
      example: "이 길은 아주 익숙해요.", note: "Used with 에 or 이/가",
      dateAdded: ago(5), status: "In progress", box: 1, nextReview: today,
      history: [{ date: ago(2), result: "got it" }]
    },
    {
      id: "sample-3", sample: true, type: "vocab",
      word: "준비하다", meaning: "to prepare",
      example: "시험을 준비해요.", note: "",
      dateAdded: ago(20), status: "Mastered", box: 4, nextReview: addDays(today, 12),
      history: [{ date: ago(10), result: "got it" }]
    },
    {
      id: "sample-4", sample: true, type: "grammar",
      word: "", point: "-(으)ㄹ까 봐", meaning: "worried that something might happen",
      example: "비가 올까 봐 우산을 가져왔어요.", note: "Use it for worries",
      dateAdded: ago(4), status: "In progress", box: 0, nextReview: today,
      history: [{ date: ago(3), result: "not yet" }]
    },
    {
      id: "sample-5", sample: true, type: "grammar",
      point: "-기 때문에", meaning: "because (a formal reason)",
      example: "바쁘기 때문에 못 가요.", note: "",
      dateAdded: ago(1), status: "New", box: -1, nextReview: ago(1), history: []
    },
    {
      id: "sample-6", sample: true, type: "mistake",
      wrong: "저는 학교에 공부해요.", correct: "저는 학교에서 공부해요.",
      why: "Use 에서 when an action happens at a place. 에 is for going to a place.",
      dateAdded: ago(3), status: "In progress", box: 0, nextReview: today,
      history: [{ date: ago(2), result: "not yet" }]
    },
    {
      id: "sample-7", sample: true, type: "mistake",
      wrong: "어제 영화를 봐요.", correct: "어제 영화를 봤어요.",
      why: "어제 means yesterday, so the verb needs the past tense.",
      dateAdded: ago(2), status: "New", box: -1, nextReview: ago(2), history: []
    },
    {
      id: "sample-8", sample: true, type: "mistake",
      wrong: "물을 마셔고 싶어요.", correct: "물을 마시고 싶어요.",
      why: "-고 싶어요 attaches to the plain verb stem, not to 아/어.",
      dateAdded: ago(8), status: "In progress", box: 2, nextReview: addDays(today, 3),
      history: [{ date: ago(4), result: "got it" }]
    }
  ];
}

// ---------- Data: start up ----------
// If nothing is saved yet (first open), start with the sample cards.
let appData = loadData();

if (!appData) {
  appData = { cards: makeSampleCards(), lastExport: null };
  saveData();
}

// ---------- Add popup ----------
// Which fields each card type has. "required" fields must be filled.
const FIELDS = {
  vocab: [
    { key: "word", label: "Korean word", required: true },
    { key: "meaning", label: "Meaning", required: true },
    { key: "example", label: "Example sentence (optional)" },
    { key: "note", label: "Note (optional)" }
  ],
  grammar: [
    { key: "point", label: "Grammar point", required: true },
    { key: "meaning", label: "Meaning / usage", required: true },
    { key: "example", label: "Example sentence", required: true },
    { key: "note", label: "Note (optional)" }
  ],
  mistake: [
    { key: "wrong", label: "What I wrote (wrong)", required: true },
    { key: "correct", label: "Correct version", required: true },
    { key: "why", label: "Why it was wrong", required: true }
  ]
};

const modal = document.getElementById("modal");
const addForm = document.getElementById("add-form");
const addMessage = document.getElementById("add-message");
const typeButtons = document.querySelectorAll(".type-btn");
let currentType = "vocab";

function showMessage(text, kind) {
  addMessage.textContent = text;
  addMessage.className = "add-message " + (kind || "");
}

// draw the input boxes for the chosen type
function renderFields() {
  const box = document.getElementById("add-fields");
  box.innerHTML = "";

  FIELDS[currentType].forEach(function (field) {
    const label = document.createElement("label");
    label.className = "field";

    const name = document.createElement("span");
    name.textContent = field.label;

    const input = document.createElement("input");
    input.type = "text";
    input.name = field.key;

    label.appendChild(name);
    label.appendChild(input);
    box.appendChild(label);
  });

  typeButtons.forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.type === currentType);
  });
}

function focusFirstField() {
  const first = addForm.querySelector("input");
  if (first) first.focus();
}

function openModal() {
  editingId = null;
  setModalMode();
  modal.hidden = false;
  showMessage("");
  renderFields();
  focusFirstField();
}

function closeModal() {
  modal.hidden = true;
  editingId = null;
}

// open and close
document.getElementById("add-btn").addEventListener("click", openModal);
document.getElementById("modal-close").addEventListener("click", closeModal);

modal.addEventListener("click", function (event) {
  if (event.target === modal) closeModal(); // click outside the card
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && !modal.hidden) closeModal();
});

// switch type
typeButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    currentType = btn.dataset.type;
    showMessage("");
    renderFields();
    focusFirstField();
  });
});

// save the card (Enter inside a box also does this)
addForm.addEventListener("submit", function (event) {
  event.preventDefault();

  // read the boxes and check the required ones
  const values = {};
  const missing = [];
  FIELDS[currentType].forEach(function (field) {
    const value = addForm.elements[field.key].value.trim();
    values[field.key] = value;
    if (field.required && !value) missing.push(field.label);
  });

  if (missing.length > 0) {
    showMessage("Please fill in: " + missing.join(", "), "error");
    return;
  }

  // editing an existing card
  if (editingId) {
    Object.assign(findCard(editingId), values);
    saveData();
    closeModal();
    refreshToday();
    renderLibrary();
    return;
  }

  // adding a new card
  const card = { id: "card-" + Date.now(), sample: false, type: currentType };
  Object.assign(card, values);
  card.dateAdded = todayString();
  card.status = "New";
  card.box = -1;
  card.nextReview = todayString(); // new cards are due the day they are added
  card.history = [];

  appData.cards.push(card);
  saveData();
  refreshToday();
  renderLibrary();

  // get ready for the next card
  renderFields();
  focusFirstField();
  showMessage("Saved ✓ Add another?", "success");
});

// ---------- Spaced repetition ----------
// box 0 = 1 day, box 1 = 3 days, box 2 = 7 days, box 3 = 14 days, box 4 = 30 days
// box -1 = never revised

// cards that are due today (or late), oldest first
function getDueCards() {
  const today = todayString();
  return appData.cards
    .filter(function (card) { return card.nextReview <= today; })
    .sort(function (a, b) { return a.nextReview.localeCompare(b.nextReview); });
}

// the user pressed "Got it" or "Not yet" on a card
function reviewCard(card, result) {
  const today = todayString();

  if (result === "got it") {
    card.box = Math.min(card.box + 1, INTERVALS.length - 1);
  } else {
    card.box = 0; // "Not yet" goes back to 1 day
  }

  // Mastered cards only come back on the longest interval
  if (card.status === "Mastered" && result === "got it") {
    card.box = INTERVALS.length - 1;
  }

  // the first time a New card is revised, it becomes In progress
  if (card.status === "New") {
    card.status = "In progress";
  }

  card.nextReview = addDays(today, INTERVALS[card.box]);
  card.history.push({ date: today, result: result });

  saveData();
  updateStreak();
}

// the user sets the tag after flipping a card
function setStatus(card, status) {
  card.status = status;
  saveData();
}

// ---------- Streak ----------
// A streak = days in a row with at least one revised card.
function calcStreak() {
  const days = {};
  appData.cards.forEach(function (card) {
    card.history.forEach(function (entry) { days[entry.date] = true; });
  });

  const today = todayString();
  // if you haven't revised yet today, the streak is still alive until the day ends
  let day = days[today] ? today : addDays(today, -1);

  let count = 0;
  while (days[day]) {
    count++;
    day = addDays(day, -1);
  }
  return count; // a missed day means the chain breaks, so it goes back to 0
}

function updateStreak() {
  const n = calcStreak();
  document.getElementById("streak").textContent = "🔥 " + n + " day streak";
}

updateStreak();

// ---------- Today screen ----------
const todayArea = document.getElementById("today-area");
let queue = [];      // ids of the cards still to revise
let flipped = false; // is the current card showing its back?
let doneCount = 0;   // cards finished in this visit

// small helper: make an element with a class and text
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function findCard(id) {
  return appData.cards.find(function (card) { return card.id === id; });
}

// what to show on the front and the back of each card type
function frontOf(card) {
  if (card.type === "vocab") return { tag: "Vocab", text: card.word, small: false };
  if (card.type === "grammar") return { tag: "Grammar", text: card.point, small: false };
  return { tag: "Mistake · what is wrong here?", text: card.wrong, small: true };
}

function backOf(card) {
  let rows;
  if (card.type === "mistake") {
    rows = [["Correct version", card.correct], ["Why it was wrong", card.why]];
  } else {
    rows = [["Meaning", card.meaning], ["Example", card.example], ["Note", card.note]];
  }
  return rows.filter(function (row) { return row[1]; }); // skip empty ones
}

// rebuild the list of due cards (keeps the card you are looking at first)
function refreshToday() {
  const currentId = queue[0];
  queue = getDueCards().map(function (card) { return card.id; });
  if (currentId && queue.includes(currentId)) {
    queue = [currentId].concat(queue.filter(function (id) { return id !== currentId; }));
  }
  renderToday();
}

function renderToday() {
  todayArea.innerHTML = "";

  // no cards at all
  if (appData.cards.length === 0) {
    const empty = el("div", "done");
    empty.appendChild(el("div", "big", "📝"));
    empty.appendChild(el("h2", "", "No cards yet"));
    empty.appendChild(el("p", "muted", "Press the blue button above to add your first card."));
    todayArea.appendChild(empty);
    return;
  }

  // nothing left to revise
  if (queue.length === 0) {
    const done = el("div", "done");
    const smile = el("div", "big");
    smile.innerHTML = '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#2e9e5b" stroke-width="3" stroke-linecap="round" aria-hidden="true"><circle cx="32" cy="32" r="28"/><circle cx="23" cy="26" r="1.5" fill="#2e9e5b"/><circle cx="41" cy="26" r="1.5" fill="#2e9e5b"/><path d="M21 38c3 6 19 6 22 0"/></svg>';
    done.appendChild(smile);
    done.appendChild(el("h2", "", "All done for today"));
    const n = calcStreak();
    done.appendChild(el("p", "muted", "🔥 " + n + " day streak. See you tomorrow."));
    todayArea.appendChild(done);
    return;
  }

  const card = findCard(queue[0]);
  const front = frontOf(card);

  todayArea.appendChild(
    el("div", "progress", "Card " + (doneCount + 1) + " of " + (doneCount + queue.length))
  );

  // the flip card
  const flashcard = el("div", "flashcard" + (flipped ? " flipped" : ""));
  const inner = el("div", "card-inner");

  const frontFace = el("div", "face front");
  frontFace.appendChild(el("div", "card-tag", front.tag));
  frontFace.appendChild(el("div", "card-main" + (front.small ? " small" : ""), front.text));
  frontFace.appendChild(el("div", "card-hint", "Click or press Space to flip"));

  const backFace = el("div", "face back");
  backFace.appendChild(el("div", "card-tag", front.tag));
  backOf(card).forEach(function (row) {
    const block = el("div", "back-row");
    block.appendChild(el("div", "back-label", row[0]));
    block.appendChild(el("div", "back-text", row[1]));
    backFace.appendChild(block);
  });

  inner.appendChild(frontFace);
  inner.appendChild(backFace);
  flashcard.appendChild(inner);
  flashcard.addEventListener("click", flipCard);
  todayArea.appendChild(flashcard);

  // the buttons under the card (hidden until you flip)
  const actions = el("div", "actions");
  actions.hidden = !flipped;

  const statusRow = el("div", "status-row");
  statusRow.appendChild(el("span", "muted", "Tag:"));
  const statusButtons = [];
  ["In progress", "Mastered"].forEach(function (status) {
    const btn = el("button", "status-btn", status);
    btn.type = "button";
    btn.dataset.status = status;
    btn.addEventListener("click", function () {
      setStatus(card, status);
      paintStatus();
    });
    statusButtons.push(btn);
    statusRow.appendChild(btn);
  });

  function paintStatus() {
    statusButtons.forEach(function (btn) {
      btn.classList.toggle("active", card.status === btn.dataset.status);
    });
  }
  paintStatus();

  const answerRow = el("div", "answer-row");
  const notYet = el("button", "answer-btn not-yet", "Not yet");
  const gotIt = el("button", "answer-btn got-it", "Got it");
  notYet.type = "button";
  gotIt.type = "button";
  notYet.addEventListener("click", function () { answer("not yet"); });
  gotIt.addEventListener("click", function () { answer("got it"); });
  answerRow.appendChild(notYet);
  answerRow.appendChild(gotIt);

  actions.appendChild(statusRow);
  actions.appendChild(answerRow);
  todayArea.appendChild(actions);
}

// flip the card to show the back
function flipCard() {
  if (flipped || queue.length === 0) return;
  flipped = true;
  todayArea.querySelector(".flashcard").classList.add("flipped");
  todayArea.querySelector(".actions").hidden = false;
}

// "Not yet" or "Got it": save, then show the next card
function answer(result) {
  if (!flipped || queue.length === 0) return;
  reviewCard(findCard(queue[0]), result);
  queue.shift();
  doneCount++;
  flipped = false;
  renderToday();
}

// keyboard: Space = flip, 1 = Not yet, 2 = Got it
document.addEventListener("keydown", function (event) {
  if (!modal.hidden) return; // popup is open
  if (!document.getElementById("screen-today").classList.contains("active")) return;
  const tag = event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (queue.length === 0) return;

  if (event.key === " ") {
    event.preventDefault();
    flipCard();
  } else if (event.key === "1") {
    answer("not yet");
  } else if (event.key === "2") {
    answer("got it");
  }
});

// stops Space from also "clicking" a button you used earlier
document.addEventListener("keyup", function (event) {
  if (event.key === " " && event.target.tagName === "BUTTON" && modal.hidden) {
    event.preventDefault();
  }
});

refreshToday();

// ---------- Library screen ----------
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// "2026-09-11" becomes "11 September 2026"
function formatDate(str) {
  if (!str) return "";
  const p = str.split("-").map(Number);
  return p[2] + " " + MONTHS[p[1] - 1] + " " + p[0];
}

const TYPE_NAMES = { vocab: "Vocab", grammar: "Grammar", mistake: "Mistake" };
const libraryArea = document.getElementById("library-area");
const filters = { search: "", type: "all", status: "all"};
let editingId = null; // the card being edited (null = adding a new card)
let libCount, libList;

// ----- edit popup -----
function setModalMode() {
  const editing = editingId !== null;
  document.querySelector(".modal-head h2").textContent = editing ? "Edit card" : "Add a card";
  document.querySelector(".type-picker").hidden = editing;
  document.querySelector(".save-btn").textContent = editing ? "Save changes" : "Save card";
}

function openEdit(card) {
  editingId = card.id;
  currentType = card.type;
  setModalMode();
  modal.hidden = false;
  showMessage("");
  renderFields();
  FIELDS[card.type].forEach(function (field) {
    addForm.elements[field.key].value = card[field.key] || "";
  });
  focusFirstField();
}

// ----- build the search box and filters (once) -----
function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function makeSelect(options, key) {
  const select = el("select", "lib-select");
  options.forEach(function (opt) { addOption(select, opt[0], opt[1]); });
  select.addEventListener("change", function () {
    filters[key] = select.value;
    renderList();
  });
  return select;
}

function buildLibrary() {
  libraryArea.innerHTML = "";

  const search = el("input", "lib-search");
  search.type = "search";
  search.placeholder = "Search your cards…";
  search.addEventListener("input", function () {
    filters.search = search.value.trim().toLowerCase();
    renderList();
  });

  const row = el("div", "lib-filters");
  row.appendChild(makeSelect(
    [["all", "All types"], ["vocab", "Vocab"], ["grammar", "Grammar"], ["mistake", "Mistake"]], "type"));
  row.appendChild(makeSelect(
    [["all", "All statuses"], ["New", "New"], ["In progress", "In progress"], ["Mastered", "Mastered"]], "status"));


  libCount = el("div", "lib-count");
  libList = el("div", "lib-list");

  libraryArea.appendChild(search);
  libraryArea.appendChild(row);
  libraryArea.appendChild(libCount);
  libraryArea.appendChild(libList);
}

function matches(card) {
  if (filters.type !== "all" && card.type !== filters.type) return false;
  if (filters.status !== "all" && card.status !== filters.status) return false;
  if (filters.search) {
    const text = [card.word, card.point, card.meaning, card.example, card.note,
      card.wrong, card.correct, card.why].join(" ").toLowerCase();
    if (!text.includes(filters.search)) return false;
  }
  return true;
}

// ----- the list -----
function mainText(card) {
  if (card.type === "vocab") return card.word;
  if (card.type === "grammar") return card.point;
  return card.wrong;
}

function subText(card) {
  if (card.type === "mistake") return "→ " + card.correct;
  return card.meaning;
}

function deleteCard(card) {
  appData.cards = appData.cards.filter(function (c) { return c.id !== card.id; });
  queue = queue.filter(function (id) { return id !== card.id; });
  flipped = false;
  saveData();
  updateStreak();
  refreshToday();
  renderLibrary();
}

function makeRow(card) {
  const row = el("div", "lib-row");
  const info = el("div", "lib-info");

  const chips = el("div", "lib-chips");
  chips.appendChild(el("span", "chip", TYPE_NAMES[card.type]));
  chips.appendChild(el("span", "chip status-" + card.status.toLowerCase().replace(" ", "-"), card.status));
  info.appendChild(chips);

  info.appendChild(el("div", "lib-main", mainText(card)));
  info.appendChild(el("div", "lib-sub", subText(card)));
  info.appendChild(el("div", "lib-dates",
    "Added " + formatDate(card.dateAdded) + " · Next review " + formatDate(card.nextReview)));

  const actions = el("div", "lib-actions");

  function showNormal() {
    actions.innerHTML = "";
    const edit = el("button", "small-btn", "Edit");
    const del = el("button", "small-btn", "Delete");
    edit.type = "button";
    del.type = "button";
    edit.addEventListener("click", function () { openEdit(card); });
    del.addEventListener("click", showConfirm);
    actions.appendChild(edit);
    actions.appendChild(del);
  }

  // delete asks "are you sure?" first
  function showConfirm() {
    actions.innerHTML = "";
    actions.appendChild(el("span", "confirm-text", "Delete this card?"));
    const yes = el("button", "small-btn danger", "Delete");
    const no = el("button", "small-btn", "Cancel");
    yes.type = "button";
    no.type = "button";
    yes.addEventListener("click", function () { deleteCard(card); });
    no.addEventListener("click", showNormal);
    actions.appendChild(yes);
    actions.appendChild(no);
  }

  showNormal();
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function renderList() {
  libList.innerHTML = "";

  // library is completely empty
  if (appData.cards.length === 0) {
    libCount.textContent = "";
    const empty = el("div", "done");
    empty.appendChild(el("div", "big", "📚"));
    empty.appendChild(el("h2", "", "Your library is empty"));
    empty.appendChild(el("p", "muted", "Cards you add will be collected here."));
    libList.appendChild(empty);
    return;
  }

  const shown = appData.cards.filter(matches).sort(function (a, b) {
    return b.dateAdded.localeCompare(a.dateAdded) || b.id.localeCompare(a.id);
  });

  libCount.textContent = shown.length + (shown.length === 1 ? " card" : " cards");

  // filters found nothing
  if (shown.length === 0) {
    const empty = el("div", "done");
    empty.appendChild(el("div", "big", "🔍"));
    empty.appendChild(el("h2", "", "No cards match"));
    empty.appendChild(el("p", "muted", "Try a different search or filter."));
    libList.appendChild(empty);
    return;
  }

  shown.forEach(function (card) { libList.appendChild(makeRow(card)); });
}

function renderLibrary() {
  renderList();
}

buildLibrary();
renderLibrary();

// refresh the list each time you open the Library tab
document.querySelector('.tab[data-screen="library"]').addEventListener("click", renderLibrary);

// ---------- Stats, backup and sample data ----------
const statsArea = document.getElementById("stats-area");
const backupBanner = document.getElementById("backup-banner");
let dataNote = { text: "", kind: "" };   // small message under the backup buttons
let confirmingSamples = false;           // is "remove sample cards?" showing?

// remember the day the app was first used (for the backup reminder)
if (!appData.startedOn) {
  appData.startedOn = todayString();
  saveData();
}

// number of days between two "2026-11-20" style dates
function daysBetween(fromStr, toStr) {
  const a = fromStr.split("-").map(Number);
  const b = toStr.split("-").map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

function setDataNote(text, kind) {
  dataNote = { text: text, kind: kind || "" };
  renderStats();
}

// ----- the numbers -----
function countStatus(status) {
  return appData.cards.filter(function (card) { return card.status === status; }).length;
}

function cardsRevisedThisWeek() {
  const weekStart = addDays(todayString(), -6); // today and the 6 days before
  return appData.cards.filter(function (card) {
    return card.history.some(function (entry) { return entry.date >= weekStart; });
  }).length;
}

// ----- small building blocks -----
function statTile(number, label) {
  const tile = el("div", "stat-tile");
  tile.appendChild(el("div", "stat-number", String(number)));
  tile.appendChild(el("div", "stat-label", label));
  return tile;
}

function barRow(label, count, total, colourClass) {
  const row = el("div", "bar-row");
  const top = el("div", "bar-top");
  top.appendChild(el("span", "", label));
  top.appendChild(el("span", "muted", String(count)));

  const track = el("div", "bar-track");
  const fill = el("div", "bar-fill " + colourClass);
  fill.style.width = (total ? Math.round((count / total) * 100) : 0) + "%";
  track.appendChild(fill);

  row.appendChild(top);
  row.appendChild(track);
  return row;
}

function plainButton(text, onClick, extraClass) {
  const btn = el("button", "small-btn " + (extraClass || ""), text);
  btn.type = "button";
  btn.addEventListener("click", onClick);
  return btn;
}

// ----- draw the Stats screen -----
function renderStats() {
  statsArea.innerHTML = "";
  const total = appData.cards.length;

  if (total === 0) {
    const empty = el("div", "done");
    empty.appendChild(el("div", "big", "📊"));
    empty.appendChild(el("h2", "", "No stats yet"));
    empty.appendChild(el("p", "muted", "Add and revise some cards, and your progress will show here."));
    statsArea.appendChild(empty);
  } else {
    const tiles = el("div", "stats-tiles");
    tiles.appendChild(statTile(total, "Total cards"));
    tiles.appendChild(statTile(cardsRevisedThisWeek(), "Revised this week"));
    tiles.appendChild(statTile(calcStreak(), "Day streak"));
    statsArea.appendChild(tiles);

    const progress = el("div", "stats-card");
    progress.appendChild(el("h2", "stats-title", "Progress"));
    progress.appendChild(barRow("Mastered", countStatus("Mastered"), total, "mastered"));
    progress.appendChild(barRow("In progress", countStatus("In progress"), total, "progress"));
    progress.appendChild(barRow("New (never revised)", countStatus("New"), total, "new"));
    statsArea.appendChild(progress);
  }

  // backup card (always shown, so you can import even with no cards)
  const backup = el("div", "stats-card");
  backup.appendChild(el("h2", "stats-title", "Backup"));
  const last = appData.lastExport ? formatDate(appData.lastExport) : "never";
  backup.appendChild(el("p", "muted backup-text", "Last backup: " + last));

  const buttons = el("div", "data-buttons");
  buttons.appendChild(plainButton("Export cards", exportCards));
  buttons.appendChild(plainButton("Import cards", function () { fileInput.click(); }));

  const hasSamples = appData.cards.some(function (card) { return card.sample; });
  if (hasSamples && !confirmingSamples) {
    buttons.appendChild(plainButton("Clear sample data", function () {
      confirmingSamples = true;
      renderStats();
    }));
  }
  if (hasSamples && confirmingSamples) {
    buttons.appendChild(el("span", "confirm-text", "Remove the sample cards?"));
    buttons.appendChild(plainButton("Remove", clearSamples, "danger"));
    buttons.appendChild(plainButton("Cancel", function () {
      confirmingSamples = false;
      renderStats();
    }));
  }
  backup.appendChild(buttons);

  if (dataNote.text) {
    backup.appendChild(el("p", "add-message " + dataNote.kind, dataNote.text));
  }
  statsArea.appendChild(backup);
}

// ----- export, import, clear samples -----
function exportCards() {
  appData.lastExport = todayString();
  saveData();

  const file = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "mistake-note-backup-" + todayString() + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);

  updateBackupBanner();
  setDataNote("Backup saved to your Downloads folder.", "success");
}

// a hidden file picker, opened by the Import button
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".json,application/json";
fileInput.hidden = true;
fileInput.addEventListener("change", function () {
  if (fileInput.files[0]) importFile(fileInput.files[0]);
  fileInput.value = "";
});
document.body.appendChild(fileInput);

function importFile(file) {
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.cards)) throw new Error("no cards in file");

      // keep only cards that look complete
      const good = data.cards.filter(function (card) {
        return card && card.id && FIELDS[card.type] && card.dateAdded &&
          card.nextReview && Array.isArray(card.history);
      });
      good.forEach(function (card) {
        if (["New", "In progress", "Mastered"].indexOf(card.status) === -1) card.status = "New";
        if (typeof card.box !== "number") card.box = -1;
      });

      const ok = window.confirm(
        "Replace your " + appData.cards.length + " current cards with the " +
        good.length + " cards from this file?"
      );
      if (!ok) return;

      appData = {
        cards: good,
        lastExport: data.lastExport || null,
        startedOn: data.startedOn || todayString()
      };
      saveData();
      queue = [];
      doneCount = 0;
      flipped = false;
      updateStreak();
      refreshToday();
      renderLibrary();
      updateBackupBanner();
      setDataNote("Imported " + good.length + " cards.", "success");
    } catch (error) {
      console.log("Import failed:", error);
      setDataNote("That file could not be read. Is it a Mistake Note backup?", "error");
    }
  };
  reader.readAsText(file);
}

function clearSamples() {
  appData.cards = appData.cards.filter(function (card) { return !card.sample; });
  queue = queue.filter(function (id) { return findCard(id); });
  flipped = false;
  confirmingSamples = false;
  saveData();
  updateStreak();
  refreshToday();
  renderLibrary();
  setDataNote("Sample cards removed.", "success");
}

// ----- the 7-day backup reminder -----
function updateBackupBanner() {
  backupBanner.innerHTML = "";
  const since = appData.lastExport || appData.startedOn;
  const days = daysBetween(since, todayString());

  const hide = appData.cards.length === 0 || days < 7 || appData.remindedOn === todayString();
  backupBanner.hidden = hide;
  if (hide) return;

  backupBanner.appendChild(el("span", "", "Time for a backup? It has been " + days + " days."));
  const buttons = el("div", "data-buttons");
  buttons.appendChild(plainButton("Back up now", exportCards));
  buttons.appendChild(plainButton("Later", function () {
    appData.remindedOn = todayString(); // ask again tomorrow
    saveData();
    updateBackupBanner();
  }));
  backupBanner.appendChild(buttons);
}

renderStats();
updateBackupBanner();

// refresh the numbers each time you open the Stats tab
document.querySelector('.tab[data-screen="stats"]').addEventListener("click", renderStats);