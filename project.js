const course = {
  id: "course_ds",
  title: "Data Structures Basics",
  lesson: {
    id: "lesson_stack",
    html: `<h3>Stack Data Structure</h3><p>A stack follows the <b>LIFO</b> principle.</p><img src="https://upload.wikimedia.org/wikipedia/commons/b/b4/Lifo_stack.png" style="max-width:100%; border-radius:8px; margin-top:10px;">`,
    image: "https://upload.wikimedia.org/wikipedia/commons/b/b4/Lifo_stack.png"
  }
};

let db;
const request = indexedDB.open("offlineCourseDB", 1);

request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore("courses", { keyPath: "id" });
  db.createObjectStore("lessons", { keyPath: "id" });
  db.createObjectStore("images", { keyPath: "url" });
};

request.onsuccess = e => {
  db = e.target.result;
  checkOfflineStatus();
  loadLesson();
};

request.onerror = () => alert("IndexedDB error");

async function downloadCourse() {
  const tx = db.transaction(["courses", "lessons", "images"], "readwrite");
  tx.objectStore("courses").put({ id: course.id, offline: true });
  tx.objectStore("lessons").put({
    id: course.lesson.id,
    content: course.lesson.html
  });
  const imgBlob = await fetch(course.lesson.image).then(res => res.blob());
  tx.objectStore("images").put({
    url: course.lesson.image,
    blob: imgBlob
  });
  tx.oncomplete = () => {
    document.getElementById("offlineBadge").style.display = "inline-block";
    showToast("Course saved for offline use!");
  };
}

function loadLesson() {
  if (navigator.onLine) {
    document.getElementById("lessonContent").innerHTML = course.lesson.html;
    return;
  }
  const tx = db.transaction(["lessons", "images"], "readonly");
  const lessonReq = tx.objectStore("lessons").get(course.lesson.id);
  lessonReq.onsuccess = () => {
    if (!lessonReq.result) {
      document.getElementById("lessonContent").innerHTML = "<p>❌ Lesson not available offline</p>";
      return;
    }
    let content = lessonReq.result.content;
    const imgReq = tx.objectStore("images").get(course.lesson.image);
    imgReq.onsuccess = () => {
      const imgURL = URL.createObjectURL(imgReq.result.blob);
      content = content.replace(course.lesson.image, imgURL);
      document.getElementById("lessonContent").innerHTML = content;
    };
  };
}

function checkOfflineStatus() {
  const tx = db.transaction("courses", "readonly");
  const req = tx.objectStore("courses").get(course.id);
  req.onsuccess = () => {
    if (req.result?.offline) {
      document.getElementById("offlineBadge").style.display = "inline-block";
    }
  };
}

function updateStatus() {
  const status = document.getElementById("status");
  status.innerText = navigator.onLine ? "🟢 Online Mode" : "🔴 Offline Mode (Using saved content)";
  loadLesson();
}

window.addEventListener("online", updateStatus);
window.addEventListener("offline", updateStatus);
updateStatus();

// ================= PART 2: REMINDER SYSTEM =================
const courses = [
  { id: 1, title: "Intro to JavaScript", status: "unfinished" },
  { id: 2, title: "Advanced React", status: "unfinished" },
  { id: 3, title: "Data Structures", status: "finished" }
];

const activeTimeouts = new Map();

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function requestPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Notifications disabled. Enable in browser settings.');
    } else {
      showToast('Notifications enabled!');
    }
  } else {
    showToast('Browser does not support notifications.');
  }
}

function renderCourses() {
  const container = document.getElementById('courses');
  container.innerHTML = '';
  courses.forEach(course => {
    if (course.status === 'unfinished') {
      const div = document.createElement('div');
      div.className = 'course-card';
      div.innerHTML = `
        <div style="flex: 1;">
          <h3 style="font-size: 1.2em; margin: 0; color: #333;">${course.title}</h3>
          <p style="font-size: 0.9em; color: #ff6b6b; margin: 5px 0;">Status: ${course.status}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
          <select id="reminder-${course.id}" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 5px;">
            <option value="none">No reminders</option>
            <option value="1hour">Remind me in 1 hour</option>
            <option value="tomorrow">Remind me tomorrow</option>
          </select>
          <button class="btn-primary" onclick="setReminder(${course.id})">Set Reminder</button>
        </div>
      `;
      container.appendChild(div);
    }
  });
}

function renderReminders() {
  const container = document.getElementById('reminders-list');
  container.innerHTML = '';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('reminder-')) {
      const reminder = JSON.parse(localStorage.getItem(key));
      const courseId = key.split('-')[1];
      const course = courses.find(c => c.id == courseId);
      const timeLeft = Math.max(0, reminder.timestamp - Date.now());
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const div = document.createElement('div');
      div.className = 'reminder-item';
      div.innerHTML = `
        <strong>${course.title}</strong> - ${reminder.choice} (${hours}h ${minutes}m left)
        <button class="btn-primary" onclick="cancelReminder(${courseId})" style="background: #e53e3e; margin-left: 10px;">Cancel</button>
      `;
      container.appendChild(div);
    }
  }
}

function setReminder(courseId) {
  const select = document.getElementById(`reminder-${courseId}`);
  const choice = select.value;
  const course = courses.find(c => c.id === courseId);
  clearReminder(courseId);
  if (choice === 'none') {
    showToast('Reminder cleared.');
    renderReminders();
    return;
  }
  let delay;
  if (choice === '1hour') delay = 60 * 60 * 1000;
  else if (choice === 'tomorrow') delay = 24 * 60 * 60 * 1000;
  const reminder = { choice, timestamp: Date.now() + delay };
  localStorage.setItem(`reminder-${courseId}`, JSON.stringify(reminder));
  const timeoutId = setTimeout(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Reminder: ${course.title}`, {
        body: 'Time to continue your course! 🚀',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM2NjdlZWEiLz4KPHBhdGggZD0iTTMyIDIwVjQwTTIwIDMySDQ0IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4='
      });
    }
    localStorage.removeItem(`reminder-${courseId}`);
    activeTimeouts.delete(courseId);
    renderReminders();
  }, delay);
  activeTimeouts.set(courseId, timeoutId);
  showToast(`Reminder set for ${course.title}!`);
  renderReminders();
}

function cancelReminder(courseId) {
  clearReminder(courseId);
  showToast('Reminder canceled.');
  renderReminders();
}

function clearReminder(courseId) {
  if (activeTimeouts.has(courseId)) {
    clearTimeout(activeTimeouts.get(courseId));
    activeTimeouts.delete(courseId);
  }
  localStorage.removeItem(`reminder-${courseId}`);
}

function restoreReminders() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('reminder-')) {
      const reminder = JSON.parse(localStorage.getItem(key));
      const courseId = key.split('-')[1];
      const timeLeft = reminder.timestamp - Date.now();
      if (timeLeft > 0) {
        const timeoutId = setTimeout(() => {
          const course = courses.find(c => c.id == courseId);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Reminder: ${course.title}`, {
              body: 'Time to continue your course! 🚀'
            });
          }
          localStorage.removeItem(key);
          activeTimeouts.delete(courseId);
          renderReminders();
        }, timeLeft);
        activeTimeouts.set(courseId, timeoutId);
      } else {
        localStorage.removeItem(key);
      }
    }
  }
}

// ================= PART 3: STREAK TRACKER =================
const BADGES = {
  7: "7-Day Streak",
  30: "30-Day Streak",
  100: "100-Day Streak"
};

function loadData() {
  return {
    currentStreak: parseInt(localStorage.getItem('currentStreak')) || 0,
    longestStreak: parseInt(localStorage.getItem('longestStreak')) || 0,
    lastActivityDate: localStorage.getItem('lastActivityDate') ? new Date(localStorage.getItem('lastActivityDate')) : null,
    badges: JSON.parse(localStorage.getItem('badges')) || []
  };
}

function saveData(data) {
  localStorage.setItem('currentStreak', data.currentStreak);
  localStorage.setItem('longestStreak', data.longestStreak);
  localStorage.setItem('lastActivityDate', data.lastActivityDate ? data.lastActivityDate.toISOString() : null);
  localStorage.setItem('badges', JSON.stringify(data.badges));
}

function updateStreak(activityMinutes) {
  const data = loadData();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (data.lastActivityDate) {
    const lastDate = new Date(data.lastActivityDate.getFullYear(), data.lastActivityDate.getMonth(), data.lastActivityDate.getDate());
    if (lastDate.getTime() === today.getTime()) {
    } else if (lastDate.getTime() === yesterday.getTime() && activityMinutes >= 5) {
      data.currentStreak += 1;
    } else {
      data.currentStreak = activityMinutes >= 5 ? 1 : 0;
    }
  } else {
    data.currentStreak = activityMinutes >= 5 ? 1 : 0;
  }

  data.longestStreak = Math.max(data.longestStreak, data.currentStreak);
  data.lastActivityDate = now;

  for (const [threshold, name] of Object.entries(BADGES)) {
    if (data.currentStreak >= parseInt(threshold) && !data.badges.includes(name)) {
      data.badges.push(name);
    }
  }

  saveData(data);
  updateUI(data);
}

function updateUI(data) {
  document.getElementById('current-streak').textContent = data.currentStreak;
  document.getElementById('longest-streak').textContent = `Longest: ${data.longestStreak} days`;
  const progress = (data.currentStreak % 7) / 7 * 100;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  const badgesDiv = document.getElementById('badges');
  badgesDiv.innerHTML = data.badges.map(badge => `<span class="badge-item"><i class="fas fa-trophy"></i> ${badge}</span>`).join('');
  const nextBadge = Object.entries(BADGES).find(([threshold, name]) => !data.badges.includes(name));
  document.getElementById('next-badge').textContent = nextBadge ? `Next: ${nextBadge[1]} (${nextBadge[0]} days)` : 'All badges earned!';
}

document.getElementById('log-activity').addEventListener('click', () => {
  updateStreak(10);
  alert('Activity logged! Streak updated.');
});

// ================= PART 4: CELEBRATION =================
const completeButton = document.getElementById('complete-course');
const modal = document.getElementById('completion-modal');

completeButton.addEventListener('click', () => {
  modal.style.display = 'block';
  confetti({
    particleCount: 150,
    spread: 90,
    origin: { y: 0.6 },
    colors: ['#ff6b6b', '#feca57', '#48cae4', '#8338ec', '#ffbe0b'],
    shapes: ['circle', 'square'],
    scalar: 1.2
  });
  setTimeout(() => {
    modal.style.display = 'none';
  }, 5000);
});

// ================= PART 5: SEARCH & FILTER =================
const searchCourses = [
  { title: "JavaScript Fundamentals", description: "Learn core JavaScript concepts from scratch.", tags: ["programming"] },
  { title: "UI/UX Design Basics", description: "Design beautiful and user-friendly interfaces.", tags: ["design"] },
  { title: "Digital Marketing 101", description: "Master SEO, social media, and online ads.", tags: ["marketing"] },
  { title: "Python for Data Science", description: "Analyze data using Python and popular libraries.", tags: ["programming", "data"] },
  { title: "React Web Development", description: "Build modern web applications with React.", tags: ["programming"] }
];

const courseGrid = document.getElementById("courseGrid");
const searchInput = document.getElementById("searchInput");
const tags = document.querySelectorAll(".tag");
const noResults = document.getElementById("noResults");

let activeTag = "all";

function renderSearchCourses() {
  const searchText = searchInput.value.toLowerCase();
  courseGrid.innerHTML = "";

  const filtered = searchCourses.filter(course => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchText) ||
      course.description.toLowerCase().includes(searchText);

    const matchesTag =
      activeTag === "all" || course.tags.includes(activeTag);

    return matchesSearch && matchesTag;
  });

  if (filtered.length === 0) {
    noResults.style.display = "block";
    return;
  }

  noResults.style.display = "none";

  filtered.forEach(course => {
    const card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML = `
      <div style="font-size: 20px; font-weight: bold;">${course.title}</div>
      <div style="font-size: 14px; margin: 10px 0; color: #555;">${course.description}</div>
      <div>${course.tags.map(tag => `<span style="display: inline-block; background: #eef2ff; color: #4338ca; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin-right: 5px;">${tag}</span>`).join("")}</div>
    `;
    courseGrid.appendChild(card);
  });
}

searchInput.addEventListener("input", renderSearchCourses);

tags.forEach(tag => {
  tag.addEventListener("click", () => {
    tags.forEach(t => t.classList.remove("active"));
    tag.classList.add("active");
    activeTag = tag.dataset.tag;
    renderSearchCourses();
  });
});

// ================= PART 6: VIDEO RESUME =================
const videoId = 'courseVideo';
const storageKey = `videoResume_${videoId}`;
const video = document.getElementById('courseVideo');
const resumeBtn = document.getElementById('resumeBtn');
const resumeMessage = document.getElementById('resumeMessage');

function saveTimestamp() {
  const currentTime = video.currentTime;
  if (currentTime > 0) {
    localStorage.setItem(storageKey, currentTime.toString());
  }
}

function loadTimestamp() {
  const savedTime = localStorage.getItem(storageKey);
  if (savedTime && !isNaN(savedTime)) {
    const time = parseFloat(savedTime);
    video.currentTime = time;
    resumeMessage.textContent = `Resumed from ${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
    resumeBtn.style.display = 'inline';
  }
}

video.addEventListener('loadedmetadata', loadTimestamp);
video.addEventListener('pause', saveTimestamp);
video.addEventListener('ended', () => {
  localStorage.removeItem(storageKey);
  resumeBtn.style.display = 'none';
});
video.addEventListener('timeupdate', () => {
  if (Math.floor(video.currentTime) % 5 === 0) saveTimestamp();
});

window.addEventListener('beforeunload', saveTimestamp);

resumeBtn.addEventListener('click', () => {
  const savedTime = localStorage.getItem(storageKey);
  if (savedTime) {
    video.currentTime = parseFloat(savedTime);
    video.play();
  }
});

// ================= INITIALIZE EVERYTHING =================
window.onload = () => {
  // Initialize all components
  requestPermission();
  renderCourses();
  restoreReminders();
  renderReminders();
  
  const streakData = loadData();
  updateUI(streakData);
  
  renderSearchCourses();
  
  // Smooth scrolling for navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    });
  });
};