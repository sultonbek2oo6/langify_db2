// ================= GLOBAL O'ZGARUVCHILAR =================
let timeLeft = 20 * 60; // 20 minut soniyalarda
let timerInterval;

const params = new URLSearchParams(window.location.search);
const testId = params.get("id");

const passageEl = document.getElementById("passage");
const container = document.getElementById("questionsContainer");
const form = document.getElementById("readingForm");

let questions = [];

// ================= TESTNI YUKLASH =================
async function loadTest() {
  if (!testId) {
    container.innerHTML = "Test ID topilmadi.";
    return;
  }

  container.innerHTML = "<div class='loading'>Loading...</div>";

  try {
    const res = await fetch(`/api/materials/${testId}`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    if (!res.ok) throw new Error("Ma'lumotlarni yuklashda xatolik");

    const data = await res.json();
    const material = data.material;
    questions = data.questions || [];

    // --- PASSAGE (MATN) QISMI ---
    let passageText = "";
    
    // JSON tekshiruvi va tozalash
    try {
      // Agar content string bo'lsa va JSON formatida bo'lsa
      const obj = JSON.parse(material.content);
      passageText = obj.passage || material.content;
    } catch (e) {
      // Agar JSON bo'lmasa (oddiy matn bo'lsa)
      passageText = material.content;
    }

    // HTML formatlash: Sarlavha va matn
    passageEl.innerHTML = `
      <h2 style="color: #1a2a6c; margin-top: 0;">${material.title || "Reading Passage"}</h2>
      <div class="passage-content">
        ${String(passageText)
          .replace(/\\n/g, "<br>") // JSON ichidagi double backslash n larni to'g'irlash
          .replace(/\n/g, "<br>")} 
      </div>
    `;

    // --- QUESTIONS (SAVOLLAR) QISMI ---
    container.innerHTML = "";
    questions.forEach((q, index) => {
      const div = document.createElement("div");
      div.className = "question";

      let answerHTML = "";
      const type = (q.type || "").toLowerCase();

      // Input turi uchun (Text input)
      if (type === "input" || (!q.option_a && !q.option_b)) {
        answerHTML = `<input type="text" name="q_${q.id}" placeholder="Write your answer here..." autocomplete="off">`;
      } 
      // True/False/Not Given turi uchun
      else if (type === "true_false" || type === "tfng") {
        const options = ["TRUE", "FALSE", "NOT GIVEN"];
        answerHTML = options.map(opt => `
          <label class="radio-label">
            <input type="radio" name="q_${q.id}" value="${opt}"> ${opt}
          </label>
        `).join("");
      } 
      // Multiple Choice (A, B, C, D)
      else {
        answerHTML = ["a", "b", "c", "d"].map(k => {
          if (!q["option_" + k]) return ""; // Agar variant bo'sh bo'lsa ko'rsatmaydi
          return `
            <label class="radio-label">
              <input type="radio" name="q_${k}_${q.id}" value="${k.toUpperCase()}">
              <span class="opt-letter">${k.toUpperCase()})</span> ${q["option_" + k]}
            </label>
          `;
        }).join("");
      }

      div.innerHTML = `
        <p class="q-text"><b>${index + 1}.</b> ${q.question_text}</p>
        <div class="answer-wrapper">${answerHTML}</div>
      `;
      container.appendChild(div);
    });

    startTimer();

  } catch (err) {
    container.innerHTML = `<div class="error">Xatolik: ${err.message}</div>`;
    console.error("Load Error:", err);
  }
}

// Sahifa yuklanganda ishga tushirish
loadTest();

// ================= TESTNI TOPSHIRISH (SUBMIT) =================
form.addEventListener("submit", async (e) => {
  if (e) e.preventDefault();
  
  // Taymerni to'xtatish
  clearInterval(timerInterval);

  const answers = questions.map((q) => {
    const elements = document.querySelectorAll(`[name="q_${q.id}"]`);
    let value = "";

    if (elements.length > 0) {
      if (elements[0].type === "radio") {
        const checked = document.querySelector(`[name="q_${q.id}"]:checked`);
        value = checked ? checked.value : "";
      } else {
        value = elements[0].value || "";
      }
    }

    return {
      question_id: q.id,
      answer: value
    };
  });

  try {
    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) submitBtn.disabled = true; // Ikki marta bosishni oldini olish

    const res = await fetch(`/api/attempts/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({
        material_id: testId,
        answers
      })
    });

    const data = await res.json();
    document.getElementById("result").innerHTML = `
      <div style="padding: 15px; background: #e8f5e9; border-radius: 10px; margin-top: 15px;">
        <h3 style="color: #2e7d32; margin: 0;">Natija: ${data.score}%</h3>
      </div>
    `;
    
    // Natija chiqqandan keyin yuqoriga skroll qilish
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error("Submit Error:", err);
    alert("Natijalarni yuborishda xatolik yuz berdi.");
  }
});

// ================= YORDAMCHI FUNKSIYALAR =================

function startTimer() {
  const display = document.getElementById("time-display");
  if (!display) return;

  timerInterval = setInterval(() => {
    let minutes = Math.floor(timeLeft / 60);
    let seconds = timeLeft % 60;
    
    display.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("Vaqt tugadi! Natijalar avtomatik yuboriladi.");
      // Formani event orqali emas, bevosita funksiya sifatida topshirish xavfsizroq
      form.requestSubmit(); 
    }
    timeLeft--;
  }, 1000);
}

function goToDashboard() {
  if (confirm("Chindan ham chiqmoqchimisiz? Bajarmagan savollaringiz saqlanmasligi mumkin.")) {
    window.location.href = "index.html"; 
  }
}

function nextTest() {
  if (confirm("Keyingi testga o'tmoqchimisiz?")) {
    window.location.reload(); 
  }
}