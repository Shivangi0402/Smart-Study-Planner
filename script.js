//Smart Study Planner
const STORAGE_KEY = "smartStudyPlannerTasks_v1";
let tasks = [];
const qs = (s) => document.querySelector(s);

// UI refs
const tasksEl = qs("#tasks");
const daysRow = qs("#daysRow");
const addForm = qs("#addForm");
const openAdd = qs("#openAdd");
const saveTaskBtn = qs("#saveTask");
const cancelAdd = qs("#cancelAdd");
const toggleView = qs("#toggleView");
const timelineEl = qs("#timeline");
const listWrap = qs("#listWrap");
const downloadPdfBtn = qs("#downloadPdfBtn");

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch (e) {
    tasks = [];
  }
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleString();
}

function render() {
  // tasks list
  tasksEl.innerHTML = "";
  tasks
    .slice()
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    .forEach((t) => {
      const el = document.createElement("div");
      el.className = "task-card";
      el.innerHTML = `
      <div class="task-left">
        <div style="display:flex;gap:10px;align-items:center">
          <div style="width:10px;height:10px;border-radius:4px;background:${
            t.color
          }"></div>
          <h3 class="task-title">${escapeHtml(t.title)}</h3>
        </div>
        <div class="meta">${escapeHtml(t.subject || "General")} • ${formatDate(
        t.datetime
      )} • ${t.priority.toUpperCase()} • ${t.duration || "-"} mins</div>
        <div style="margin-top:8px;color:var(--muted);font-size:13px">${escapeHtml(
          t.notes || ""
        )}</div>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
          <label style="font-size:13px;color:var(--muted)">Progress</label>
          <input type="range" min="0" max="100" value="${
            t.progress || 0
          }" data-id="${t.id}" class="progressRange" />
          <div style="min-width:36px;text-align:right;font-weight:700">${
            t.progress || 0
          }%</div>
        </div>
      </div>
      <div class="task-actions">
        <button class="small" data-action="toggle" data-id="${t.id}">${
        t.done ? "Undo" : "Done"
      }</button>
        <button class="small" data-action="edit" data-id="${t.id}">Edit</button>
        <button class="small" data-action="delete" data-id="${
          t.id
        }">Delete</button>
      </div>
    `;
      if (t.done) el.style.opacity = 0.6;
      else el.style.opacity = 1;
      tasksEl.appendChild(el);
    });

  // timeline next 7 days
  daysRow.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayTasks = tasks
      .filter((t) => t.datetime && t.datetime.slice(0, 10) === iso)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    const dayEl = document.createElement("div");
    dayEl.className = "day";
    dayEl.innerHTML = `<h3>${d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })}</h3>`;
    dayTasks.forEach((t) => {
      const time = new Date(t.datetime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.style.background = t.color + "33";
      pill.textContent = `${time} • ${t.title}`;
      dayEl.appendChild(pill);
    });
    daysRow.appendChild(dayEl);
  }

  // stats (overview card)
  const total = tasks.length;
  const todayCount = tasks.filter((t) => {
    const d = t.datetime ? new Date(t.datetime) : null;
    if (!d) return false;
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const doneCount = tasks.filter((t) => t.progress >= 100 || t.done).length;
  const est = tasks.reduce((s, t) => s + (Number(t.duration) || 0), 0);
  qs("#statTotal").textContent = total;
  qs("#statToday").textContent = todayCount;
  qs("#statDone").textContent = total
    ? Math.round((doneCount / total) * 100) + "%"
    : "0%";
  qs("#statFocus").textContent = est;
  qs("#overallFill").style.width = total
    ? (doneCount / total) * 100 + "%"
    : "0%";

  // wire actions
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => b.addEventListener("click", onAction));
  document
    .querySelectorAll(".progressRange")
    .forEach((r) => r.addEventListener("input", onProgressChange));

  // schedule reminders
  scheduleAllReminders();
}

function onProgressChange(e) {
  const id = e.target.dataset.id;
  const val = Number(e.target.value);
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.progress = val;
  if (val >= 100) t.done = true;
  persist();
  render();
}

function onAction(e) {
  const id = e.target.dataset.id;
  const action = e.target.dataset.action;
  if (action === "delete") {
    tasks = tasks.filter((t) => t.id !== id);
    persist();
    render();
    return;
  }
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  if (action === "toggle") {
    t.done = !t.done;
    if (t.done) t.progress = 100;
    persist();
    render();
    return;
  }
  if (action === "edit") {
    addForm.style.display = "block";
    qs("#title").value = t.title;
    qs("#date").value = t.datetime ? t.datetime.slice(0, 10) : "";
    qs("#time").value = t.datetime ? t.datetime.slice(11, 16) : "";
    qs("#priority").value = t.priority || "low";
    qs("#subject").value = t.subject || "";
    qs("#duration").value = t.duration || "";
    qs("#color").value = t.color || "#7c3aed";
    qs("#notes").value = t.notes || "";
    saveTaskBtn.dataset.edit = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

openAdd.addEventListener("click", () => {
  addForm.style.display = addForm.style.display === "none" ? "block" : "none";
  saveTaskBtn.dataset.edit = "";
});
cancelAdd.addEventListener("click", () => {
  addForm.style.display = "none";
  clearForm();
});

saveTaskBtn.addEventListener("click", () => {
  const title = qs("#title").value.trim();
  if (!title) {
    alert("Enter a title");
    return;
  }
  const date = qs("#date").value;
  const time = qs("#time").value;
  let datetime = "";
  if (date) {
    datetime = date + "T" + (time || "00:00");
  }
  const priority = qs("#priority").value;
  const subject = qs("#subject").value;
  const duration = qs("#duration").value;
  const color = qs("#color").value;
  const notes = qs("#notes").value;
  const remindOffset = Number(qs("#remindOffset").value);

  if (saveTaskBtn.dataset.edit) {
    const id = saveTaskBtn.dataset.edit;
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.title = title;
    t.datetime = datetime;
    t.priority = priority;
    t.subject = subject;
    t.duration = duration;
    t.color = color;
    t.notes = notes;
    t.remindOffset = remindOffset;
    persist();
    render();
    addForm.style.display = "none";
    clearForm();
    return;
  }

  const newTask = {
    id: uid(),
    title,
    datetime,
    priority,
    subject,
    duration,
    color,
    notes,
    progress: 0,
    done: false,
    created: new Date().toISOString(),
    remindOffset,
  };
  tasks.push(newTask);
  persist();
  render();
  addForm.style.display = "none";
  clearForm();
});

function clearForm() {
  qs("#title").value = "";
  qs("#date").value = "";
  qs("#time").value = "";
  qs("#priority").value = "low";
  qs("#subject").value = "";
  qs("#duration").value = "";
  qs("#notes").value = "";
  qs("#color").value = "#7c3aed";
  saveTaskBtn.dataset.edit = "";
}

// notifications & reminders
function requestNotification() {
  if ("Notification" in window && Notification.permission !== "granted")
    Notification.requestPermission();
}

/* show notification + play local ding sound */
async function notify(title, body) {
  let showedSystem = false;

  if ("Notification" in window) {
    if (Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      showedSystem = true;
    }
  }

  // always play sound FIRST (not tied to notifications)
  const a = qs('#ding');
  try {
    a.currentTime = 0;
    await a.play();
  } catch (e) {
    console.error("Sound error:", e);
  }

  // fallback popup banner if no system notification
  if (!showedSystem) {
    const banner = qs("#reminderBanner");
    const text = qs("#reminderText");
    text.textContent = `${title} • ${body}`;
    banner.style.display = "block";

    // auto-hide after 15 seconds
    setTimeout(() => {
      banner.style.display = "none";
    }, 15000);

    // close button
    qs("#closeBanner").onclick = () => {
      banner.style.display = "none";
    };
  }
}

const reminderTimeouts = new Map();
function scheduleAllReminders() {
  for (const v of reminderTimeouts.values()) clearTimeout(v);
  reminderTimeouts.clear();
  tasks.forEach((t) => {
    if (!t.datetime) return;
    const remindBefore = Number(t.remindOffset || 0);
    const dt = new Date(t.datetime);
    if (isNaN(dt)) return;
    const remindAt = new Date(dt.getTime() - remindBefore * 60000);
    const ms = remindAt.getTime() - Date.now();
    if (ms > 0 && ms < 1000 * 60 * 60 * 24 * 7) {
      const to = setTimeout(() => {
        notify(
          "Task reminder: " + t.title,
          t.subject + " • " + new Date(t.datetime).toLocaleString()
        );
      }, ms);
      reminderTimeouts.set(t.id, to);
    }
  });
}

// utility
function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// toggle view
toggleView.addEventListener("click", () => {
  if (
    timelineEl.style.display === "none" ||
    window.getComputedStyle(timelineEl).display === "none"
  ) {
    timelineEl.style.display = "block";
    listWrap.style.display = "block";
  } else {
    timelineEl.style.display = "none";
    listWrap.style.display = "block";
    document.documentElement.style.overflowX = "hidden";
  }
});

//PDF Generation
downloadPdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("landscape", "mm", "a4");
  doc.setFontSize(16);
  doc.text("Weekly Timetable", 15, 15);

  let y = 25;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayTasks = tasks.filter(
      (t) => t.datetime && t.datetime.slice(0, 10) === iso
    );

    doc.setFontSize(12);
    doc.text(d.toDateString(), 15, y);
    y += 6;

    dayTasks.forEach((t) => {
      doc.setFontSize(10);
      const timeStr = t.datetime
        ? new Date(t.datetime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      doc.text(`- ${t.title} (${t.subject || "General"}) at ${timeStr}`, 20, y);
      y += 5;
    });

    y += 4;
    if (y > 190) {
      doc.addPage();
      y = 20;
    }
  }
  doc.save("Weekly_timetable.pdf");
});

//start app
load();
render();
requestNotification();
