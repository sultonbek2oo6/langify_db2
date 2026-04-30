const API_BASE = "http://localhost:3000";
let TIME_LEFT = 0;
let TIMER = null;
let TASK_ID = null;

function getId() {
  const url = new URLSearchParams(window.location.search);
  return url.get("id");
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function loadTask() {
    const params = new URLSearchParams(window.location.search);
    TASK_ID = params.get("id");

    // 1. Tokenni tekshirish
    const token = localStorage.getItem("token"); 
    if (!token) {
        alert("Sessiya muddati tugagan. Iltimos, qayta kiring.");
        window.location.href = "index.html"; 
        return;
    }

    if (!TASK_ID) {
        alert("ID topilmadi");
        window.location.href = "index.html";
        return;
    }

    try {
        const url = `${API_BASE}/api/writing/tasks/${TASK_ID}`;
        
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // Tokenni yuborish 403 xatosini yo'qotadi
            }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                alert("Ruxsat berilmadi yoki sessiya tugadi.");
                window.location.href = "index.html";
                return;
            }
            throw new Error(`Server xatosi: ${res.status}`);
        }

        const data = await res.json();
        const task = data.task || data;

        document.getElementById("title").innerText = task.title || "No title";
        document.getElementById("meta").innerHTML = `
            <p>Type: ${task.task_type || task.type || "-"}</p>
            <p>Min words: ${task.min_words || task.minWords || 0}</p>
            <p>Time: ${task.time_limit || task.timeLimit || 40} min</p>
        `;
        document.getElementById("prompt").innerHTML = task.prompt || task.description || "No prompt";

        TIME_LEFT = (task.time_limit || 40) * 60;
        startTimer();

    } catch (err) {
        console.error("Xatolik:", err);
        alert("Xatolik yuz berdi: " + err.message);
    }
}

function startTimer() {
  TIMER = setInterval(() => {
    let m = Math.floor(TIME_LEFT / 60);
    let s = TIME_LEFT % 60;

    document.getElementById("timer").innerText =
      `${m}:${s < 10 ? "0" : ""}${s}`;

    TIME_LEFT--;

    if (TIME_LEFT <= 0) {
      clearInterval(TIMER);
      submitEssay(); // AUTO
    }
  }, 1000);
}

function bindWord() {
  const t = document.getElementById("essay");
  const c = document.getElementById("count");

  t.addEventListener("input", () => {
    c.innerText = "Words: " + countWords(t.value);
  });
}

async function submitEssay() {
  const text = document.getElementById("essay").value;
  const token = localStorage.getItem("token");

  if (!text.trim()) return alert("Write something!");

  clearInterval(TIMER);

  try {
    const res = await fetch(`${API_BASE}/api/writing/submit`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify({
        task_id: TASK_ID,
        essay_text: text
      })
    });

    if (res.ok) {
      alert("Submitted!");
      window.location.href = "index.html";
    } else {
      alert("Xatolik yuz berdi!");
    }
  } catch (e) {
    console.error(e);
  }
}

function goBack() {
  window.location.href = "index.html";
}

loadTask();
bindWord();
// So'z sanash funksiyasi
const textarea = document.getElementById("essay");
const counter = document.getElementById("wordCount");

textarea.addEventListener("input", () => {
    const text = textarea.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    counter.textContent = `Words: ${words}`;
});
