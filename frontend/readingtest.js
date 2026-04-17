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

  container.innerHTML = "Loading...";

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
    let passageText = material.content;
    try {
      const obj = JSON.parse(material.content);
      passageText = obj.passage || material.content;
    } catch (e) {
      passageText = material.content;
    }

    passageEl.innerHTML = `
      <h2>${material.title || "Reading Passage"}</h2>
      <div style="line-height:1.8;">
        ${String(passageText).replace(/\n/g, "<br>")}
      </div>
    `;

    // --- QUESTIONS (SAVOLLAR) QISMI ---
    container.innerHTML = "";
    questions.forEach((q, index) => {
      const div = document.createElement("div");
      div.className = "question";

      let answerHTML = "";
      const type = (q.type || "").toLowerCase();

      if (type === "input") {
        answerHTML = `<input type="text" name="q_${q.id}" placeholder="Write answer">`;
      } 
      else if (type === "true_false") {
        answerHTML = `
          <label><input type="radio" name="q_${q.id}" value="TRUE"> TRUE</label><br>
          <label><input type="radio" name="q_${q.id}" value="FALSE"> FALSE</label><br>
          <label><input type="radio" name="q_${q.id}" value="NOT GIVEN"> NOT GIVEN</label>
        `;
      } 
      else if (!q.option_a && !q.option_b && !q.option_c && !q.option_d) {
        answerHTML = `<input type="text" name="q_${q.id}" placeholder="Write answer">`;
      } 
      else {
        answerHTML = ["A", "B", "C", "D"].map(k => `
          <label style="display: block; margin-bottom: 5px; cursor: pointer;">
            <input type="radio" name="q_${q.id}" value="${k}">
            ${k}) ${q["option_" + k.toLowerCase()] || ""}
          </label>
        `).join("");
      }

      div.innerHTML = `
        <p><b>${index + 1}) ${q.question_text}</b></p>
        <div class="answer-options">${answerHTML}</div>
      `;
      container.appendChild(div);
    });

    // Test muvaffaqiyatli yuklangach, taymerni boshlash
    startTimer();

  } catch (err) {
    container.innerHTML = "Error loading test. Please check your connection.";
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