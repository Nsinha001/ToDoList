const today = new Date();
const isoToday = today.toISOString().slice(0, 10);
const isoTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);
const isoInThree = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3).toISOString().slice(0, 10);

const defaultTasks = [];

const courseColors = {
  "Computer Science": "#8668d9",
  "Calculus II": "#65a6df",
  "World History": "#e9a95e",
  "Psychology": "#63bda1",
  "Imported": "#b38cff"
};

const defaultCourseNames = [];
let courses = JSON.parse(localStorage.getItem("studyflowCourses")) || defaultCourseNames;
const palette = ["#8668d9", "#65a6df", "#e9a95e", "#63bda1", "#b38cff", "#db7fa8", "#79b7a5", "#dd846f"];

let tasks = JSON.parse(localStorage.getItem("studyflowTasks")) || defaultTasks;
const savedNavigation = JSON.parse(localStorage.getItem("studyflowNavigation") || "null");
const savedView = ["today", "upcoming", "calendar", "completed", "all"].includes(savedNavigation?.view)
  ? savedNavigation.view
  : "today";
let currentView = savedView;
let currentCourse = typeof savedNavigation?.course === "string" ? savedNavigation.course : null;
let calendarMonth = savedNavigation?.month
  ? new Date(`${savedNavigation.month}-01T00:00:00`)
  : new Date(today.getFullYear(), today.getMonth(), 1);
if (Number.isNaN(calendarMonth.getTime())) calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);

if (localStorage.getItem("studyflowBlankStart") !== "1") {
  localStorage.removeItem("studyflowTasks");
  localStorage.removeItem("studyflowCourses");
  localStorage.setItem("studyflowBlankStart", "1");
  tasks = [];
  courses = [];
}

const taskList = document.getElementById("taskList");
const taskDialog = document.getElementById("taskDialog");
const taskForm = document.getElementById("taskForm");
const themeSelect = document.getElementById("themeSelect");
const themes = ["purple", "dark", "ocean", "forest"];

function applyTheme(theme) {
  const selectedTheme = themes.includes(theme) ? theme : "purple";
  document.body.dataset.theme = selectedTheme;
  themeSelect.value = selectedTheme;
  localStorage.setItem("studyflowTheme", selectedTheme);
}

function saveTasks() {
  localStorage.setItem("studyflowTasks", JSON.stringify(tasks));
}

function formatDate(dateValue) {
  if (!dateValue) return "No due date";
  const date = new Date(dateValue + "T00:00:00");
  if (dateValue === isoToday) return "Today";
  if (dateValue === isoTomorrow) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function saveCourses() {
  localStorage.setItem("studyflowCourses", JSON.stringify(courses));
}

function saveNavigation() {
  localStorage.setItem("studyflowNavigation", JSON.stringify({
    view: currentView,
    course: currentCourse,
    month: `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`
  }));
}

function getCourseColor(course) {
  if (courseColors[course]) return courseColors[course];
  const index = courses.indexOf(course);
  return palette[index >= 0 ? index % palette.length : 0];
}

function detectCourse(text, fallback = "") {
  const normalized = String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const match = courses.find(course => {
    const courseName = course.toLowerCase();
    if (normalized.includes(courseName)) return true;
    const words = courseName.split(/\s+/).filter(word => word.length >= 4);
    return words.some(word => normalized.includes(word));
  });
  if (match) return match;

  const bracketMatch = String(text || "").match(/[\[(]([^[\]()]{2,40})[\])]/);
  if (bracketMatch) {
    const name = bracketMatch[1].trim();
    addCourse(name);
    return name;
  }
  return fallback && fallback !== "Imported" ? fallback : "Imported";
}

function isAssignmentName(name) {
  const value = String(name || "").trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  const classOnly = /^(?:class|lecture|seminar|discussion|recitation|office\s*hours)\b/i
    .test(lower)
    || /\b(?:lecture|class|office\s*hours)\s*(?:meeting|session)\b/i.test(lower)
    || courses.some(course => lower === course.toLowerCase());
  return !classOnly;
}

function addCourse(name) {
  const cleanName = name.trim();
  if (!cleanName || courses.includes(cleanName)) return false;
  courses.push(cleanName);
  saveCourses();
  renderCourses();
  return true;
}

function renderCourses() {
  const courseList = document.getElementById("courseList");
  courseList.innerHTML = courses.map((course, index) => `
    <button class="course-item${currentCourse === course ? " active" : ""}" data-course="${escapeHtml(course)}">
      <span class="course-dot" style="background:${getCourseColor(course)}"></span>
      <span>${escapeHtml(course)}</span>
    </button>`).join("");

  const taskCourse = document.getElementById("taskCourse");
  const selected = taskCourse.value;
  taskCourse.innerHTML = courses.length
    ? courses.map(course => `<option>${escapeHtml(course)}</option>`).join("") + `<option>Imported</option>`
    : `<option value="" disabled selected>Add a course first</option>`;
  if (courses.includes(selected)) taskCourse.value = selected;

  courseList.querySelectorAll(".course-item").forEach(button => {
    button.addEventListener("click", () => {
      currentCourse = button.dataset.course;
      currentView = "all";
      saveNavigation();
      document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
      document.querySelectorAll(".course-item").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(".sidebar").classList.remove("open");
      render();
    });
  });
}

function getVisibleTasks() {
  let visible = [...tasks];
  if (currentCourse) visible = visible.filter(task => task.course === currentCourse);
  if (currentView === "today") visible = visible.filter(task => task.due === isoToday);
  if (currentView === "upcoming") visible = visible.filter(task => task.due && task.due > isoToday && !task.completed);
  if (currentView === "completed") visible = visible.filter(task => task.completed);
  if (currentView === "calendar") visible = visible.filter(task => task.due);
  return visible.sort((a, b) => Number(a.completed) - Number(b.completed));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function googleCalendarUrl(task) {
  const date = task.due || isoToday;
  const time = task.time || "09:00";
  const start = new Date(`${date}T${time}:00`);
  const duration = Number(task.duration) || 60;
  const end = new Date(start.getTime() + duration * 60000);
  const formatGoogleDate = value => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: task.name,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details: `${task.course}${task.notes ? `\n${task.notes}` : ""}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function renderCalendar() {
  const calendarView = document.getElementById("calendarView");
  const monthLabel = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  let html = `
    <div class="calendar-toolbar">
      <div class="calendar-month-nav">
        <button class="calendar-nav-button" id="previousMonth" aria-label="Previous month">&lsaquo;</button>
        <h2>${monthLabel}</h2>
        <button class="calendar-nav-button" id="nextMonth" aria-label="Next month">&rsaquo;</button>
      </div>
      <div class="calendar-actions">
        <input type="file" id="importCalendarFile" accept=".ics,text/calendar" hidden />
        <button class="calendar-import" id="importCalendar">Import .ics</button>
        <button class="calendar-export" id="exportCalendar">Export .ics</button>
      </div>
    </div>
    <div class="calendar-grid">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<div class="calendar-weekday">${day}</div>`).join("")}`;

  for (let index = 0; index < 42; index++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(date);
    const dayTasks = tasks.filter(task => task.due === dateKey);
    const outside = date.getMonth() !== calendarMonth.getMonth();
    html += `<div class="calendar-day${outside ? " outside" : ""}${dateKey === isoToday ? " today" : ""}">
      <button class="calendar-day-number" data-add-date="${dateKey}" title="Add task on ${dateKey}">${date.getDate()}</button>
      <div class="calendar-events">${dayTasks.slice(0, 3).map(task => `
        <a class="calendar-event${task.completed ? " completed" : ""}" href="${googleCalendarUrl(task)}" target="_blank" rel="noopener" style="--course-color:${courseColors[task.course] || "#8668d9"}" title="Open in Google Calendar">
          ${task.time ? `<span class="event-time">${task.time}</span>` : ""}
          <span>${escapeHtml(task.name)}</span>
        </a>`).join("")}${dayTasks.length > 3 ? `<span class="calendar-more">+${dayTasks.length - 3} more</span>` : ""}</div>
    </div>`;
  }

  html += "</div>";
  calendarView.innerHTML = html;

  document.getElementById("previousMonth").addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    saveNavigation();
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    saveNavigation();
    renderCalendar();
  });
  document.getElementById("exportCalendar").addEventListener("click", exportCalendar);
  document.getElementById("importCalendar").addEventListener("click", () => {
    document.getElementById("importCalendarFile").click();
  });
  document.getElementById("importCalendarFile").addEventListener("change", event => {
    if (event.target.files[0]) importCalendar(event.target.files[0]);
  });
  calendarView.querySelectorAll("[data-add-date]").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById("taskDue").value = button.dataset.addDate;
      taskDialog.showModal();
    });
  });
}

function escapeIcs(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function unfoldIcsLines(content) {
  return content.replace(/\r\n[ \t]/g, "").replace(/\r/g, "\n").split("\n");
}

function getIcsProperty(lines, property) {
  const line = lines.find(item => item.toUpperCase().startsWith(`${property}:`) || item.toUpperCase().startsWith(`${property};`));
  if (!line) return "";
  return line.slice(line.indexOf(":") + 1).trim();
}

function parseIcsDate(value) {
  if (!value) return null;
  value = value.trim();
  if (/^\d{8}$/.test(value)) {
    return {
      due: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      time: ""
    };
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, , utc] = match;
  if (utc) {
    return {
      due: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`
    };
  }
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return {
    due: toDateKey(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  };
}

function unescapeIcs(value) {
  return String(value).replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

async function importCalendar(file) {
  try {
    const content = await file.text();
    const lines = unfoldIcsLines(content);
    const calendarName = unescapeIcs(getIcsProperty(lines, "X-WR-CALNAME"));
    let imported = 0;

    for (let index = 0; index < lines.length; index++) {
      if (lines[index].trim().toUpperCase() !== "BEGIN:VEVENT") continue;
      const eventLines = [];
      for (index++; index < lines.length && lines[index].trim().toUpperCase() !== "END:VEVENT"; index++) {
        eventLines.push(lines[index]);
      }

      const startValue = getIcsProperty(eventLines, "DTSTART");
      const endValue = getIcsProperty(eventLines, "DTEND");
      const parsedStart = parseIcsDate(startValue);
      if (!parsedStart) continue;

      const parsedEnd = parseIcsDate(endValue);
      let duration = 60;
      if (parsedStart.time && parsedEnd && parsedEnd.time) {
        const startDate = new Date(`${parsedStart.due}T${parsedStart.time}:00`);
        const endDate = new Date(`${parsedEnd.due}T${parsedEnd.time}:00`);
        duration = Math.max(15, Math.round((endDate - startDate) / 60000));
      }

      const name = unescapeIcs(getIcsProperty(eventLines, "SUMMARY") || "Imported event");
      const notes = unescapeIcs(getIcsProperty(eventLines, "DESCRIPTION"));
      if (!isAssignmentName(name)) continue;
      const importCourse = detectCourse(`${name} ${notes}`, calendarName);
      tasks.push({
        id: `imported-${Date.now()}-${imported}`,
        name,
        course: importCourse,
        due: parsedStart.due,
        time: parsedStart.time,
        duration,
        notes,
        completed: false
      });
      imported++;
    }

    if (imported) {
      saveTasks();
      render();
      document.getElementById("importCalendarFile").value = "";
      alert(`${imported} ${imported === 1 ? "assignment" : "assignments"} imported.`);
    } else {
      alert("No calendar events were found in that file.");
    }
  } catch (error) {
    alert("That calendar file could not be imported.");
  }
}

function exportCalendar() {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StudyFlow//Task Calendar//EN", "CALSCALE:GREGORIAN"];
  tasks.filter(task => task.due).forEach(task => {
    const date = task.due.replace(/-/g, "");
    const time = (task.time || "0900").replace(":", "");
    const start = new Date(`${task.due}T${task.time || "09:00"}:00`);
    const end = new Date(start.getTime() + (Number(task.duration) || 60) * 60000);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const endCompact = end.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@studyflow.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${time}00`,
      `DTEND:${endCompact}`,
      `SUMMARY:${escapeIcs(task.name)}`,
      `DESCRIPTION:${escapeIcs(`${task.course}${task.notes ? ` - ${task.notes}` : ""}`)}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "studyflow-calendar.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  const visible = getVisibleTasks();
  taskList.innerHTML = "";
  const calendarView = document.getElementById("calendarView");
  const isCalendar = currentView === "calendar";
  taskList.hidden = isCalendar;
  calendarView.hidden = !isCalendar;

  if (isCalendar) {
    renderCalendar();
  } else if (!visible.length) {
    taskList.innerHTML = `<div class="empty-state"><div><strong>${currentView === "completed" ? "No completed assignments" : "You're all caught up"}</strong><span>Nothing here right now.</span></div></div>`;
  } else {
    visible.forEach(task => {
      const card = document.createElement("article");
      card.className = `task-card${task.completed ? " completed" : ""}`;
      card.innerHTML = `
        <button class="task-check" data-id="${task.id}" aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}"></button>
        <div class="task-main">
          <p class="task-name">${escapeHtml(task.name)}</p>
          <div class="task-meta">
            <span class="course-pill" style="--course-color:${getCourseColor(task.course)}">${escapeHtml(task.course)}</span>
            <span>·</span>
            <span class="due${task.due && task.due < isoToday && !task.completed ? " overdue" : ""}">${formatDate(task.due)}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="task-menu" data-menu="${task.id}" aria-label="Assignment actions" aria-expanded="false">
            <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>
          <div class="task-action-menu" data-actions="${task.id}" hidden>
            <button type="button" data-toggle="${task.id}">${task.completed ? "Mark incomplete" : "Mark complete"}</button>
            <button type="button" data-edit-course="${task.id}">Change course</button>
            <button type="button" class="danger" data-delete="${task.id}">Delete assignment</button>
          </div>
        </div>`;
      taskList.appendChild(card);
    });
  }

  const todayTasks = tasks.filter(task => task.due === isoToday);
  const completedToday = todayTasks.filter(task => task.completed).length;
  const percent = todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  document.getElementById("progressText").textContent = `${percent}%`;
  document.getElementById("ringProgress").style.strokeDashoffset = 97.4 * (1 - percent / 100);
  document.getElementById("todayCount").textContent = todayTasks.filter(task => !task.completed).length;
  document.getElementById("upcomingCount").textContent = tasks.filter(task => task.due && task.due > isoToday && !task.completed).length;
  document.getElementById("taskSummary").textContent = `${visible.length} ${visible.length === 1 ? "assignment" : "assignments"}`;

  const titleNames = { today: "Today", upcoming: "Upcoming", completed: "Completed", calendar: "Calendar" };
  document.getElementById("pageTitle").textContent = currentCourse || titleNames[currentView];
  document.getElementById("sectionTitle").textContent = currentCourse ? `${currentCourse} assignments` : (currentView === "today" ? "Assignments for today" : titleNames[currentView]);
}

document.getElementById("currentDate").textContent = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
document.getElementById("taskDue").value = isoToday;

function updateDetectedCourse() {
  if (!courses.length) return;
  const name = document.getElementById("taskName").value;
  const notes = document.getElementById("taskNotes").value;
  const detected = detectCourse(`${name} ${notes}`);
  if (detected !== "Imported") {
    const taskCourse = document.getElementById("taskCourse");
    taskCourse.value = detected;
  }
}

document.getElementById("taskName").addEventListener("input", updateDetectedCourse);
document.getElementById("taskNotes").addEventListener("input", updateDetectedCourse);

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    currentCourse = null;
    saveNavigation();
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".course-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(".sidebar").classList.remove("open");
    render();
  });
});

taskList.addEventListener("click", event => {
  const check = event.target.closest("[data-id]");
  const menuButton = event.target.closest("[data-menu]");
  const toggleButton = event.target.closest("[data-toggle]");
  const courseButton = event.target.closest("[data-edit-course]");
  const deleteButton = event.target.closest("[data-delete]");
  const taskId = menuButton ? String(menuButton.dataset.menu)
    : toggleButton ? String(toggleButton.dataset.toggle)
    : courseButton ? String(courseButton.dataset.editCourse)
    : deleteButton ? String(deleteButton.dataset.delete)
    : check ? String(check.dataset.id) : "";
  if (check) {
    const task = tasks.find(item => String(item.id) === taskId);
    if (task) task.completed = !task.completed;
  }
  if (toggleButton) {
    const task = tasks.find(item => String(item.id) === taskId);
    if (task) task.completed = !task.completed;
  }
  if (deleteButton) {
    tasks = tasks.filter(item => String(item.id) !== taskId);
  }
  if (courseButton) {
    const task = tasks.find(item => String(item.id) === taskId);
    if (!task) return;
    const nextCourse = prompt("Enter course name", task.course || "");
    if (nextCourse) {
      const cleanCourse = nextCourse.trim();
      if (!courses.includes(cleanCourse)) addCourse(cleanCourse);
      task.course = cleanCourse;
    }
  }
  if (menuButton) {
    const menu = taskList.querySelector(`[data-actions="${CSS.escape(taskId)}"]`);
    const isOpen = menu && !menu.hidden;
    taskList.querySelectorAll(".task-action-menu").forEach(item => item.hidden = true);
    taskList.querySelectorAll("[data-menu]").forEach(item => item.setAttribute("aria-expanded", "false"));
    if (menu) {
      menu.hidden = isOpen;
      menuButton.setAttribute("aria-expanded", String(!isOpen));
    }
    return;
  }
  if (check || toggleButton || deleteButton || courseButton) {
    saveTasks();
    render();
  }
});

document.addEventListener("click", event => {
  if (!event.target.closest(".task-actions")) {
    taskList.querySelectorAll(".task-action-menu").forEach(item => item.hidden = true);
    taskList.querySelectorAll("[data-menu]").forEach(item => item.setAttribute("aria-expanded", "false"));
  }
});

document.getElementById("addTaskButton").addEventListener("click", () => taskDialog.showModal());
document.getElementById("closeDialog").addEventListener("click", () => taskDialog.close());
taskDialog.addEventListener("click", event => {
  if (event.target === taskDialog) taskDialog.close();
});

taskForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("taskName").value.trim();
  if (!name) return;
  if (!isAssignmentName(name)) {
    alert("Classes and meetings should be added under My courses, not as assignments.");
    return;
  }
  if (!courses.length) {
    taskDialog.close();
    courseDialog.showModal();
    return;
  }
  const selectedCourse = document.getElementById("taskCourse").value;
  const notes = document.getElementById("taskNotes").value.trim();
  const detectedCourse = detectCourse(`${name} ${notes}`);
  const course = detectedCourse !== "Imported" ? detectedCourse : (selectedCourse === "Imported" ? "Imported" : selectedCourse);
  tasks.push({
    id: Date.now(),
    name,
    course,
    due: document.getElementById("taskDue").value,
    time: document.getElementById("taskTime").value,
    duration: Number(document.getElementById("taskDuration").value),
    notes,
    completed: false
  });
  saveTasks();
  taskForm.reset();
  document.getElementById("taskDue").value = isoToday;
  document.getElementById("taskTime").value = "";
  document.getElementById("taskDuration").value = "60";
  taskDialog.close();
  if (currentView !== "calendar") {
    currentView = "today";
    currentCourse = null;
    saveNavigation();
  }
  render();
});

document.getElementById("mobileMenu").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("open");
});

themeSelect.addEventListener("change", event => applyTheme(event.target.value));

const courseDialog = document.getElementById("courseDialog");
const courseForm = document.getElementById("courseForm");
document.getElementById("addCourseButton").addEventListener("click", () => courseDialog.showModal());
document.getElementById("closeCourseDialog").addEventListener("click", () => courseDialog.close());
courseDialog.addEventListener("click", event => {
  if (event.target === courseDialog) courseDialog.close();
});
courseForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("courseName").value.trim();
  if (!name) return;
  addCourse(name);
  courseForm.reset();
  courseDialog.close();
});

applyTheme(localStorage.getItem("studyflowTheme"));
renderCourses();
document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === currentView));
render();
