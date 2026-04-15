const params = new URLSearchParams(window.location.search);
const testId = params.get("id");

const passageEl = document.getElementById("passage");
const container = document.getElementById("questionsContainer");
const form = document.getElementById("readingForm");

let questions = [];

// ================= LOAD TEST =================
async function loadTest() {
  container.innerHTML = "Loading...";

  try {
    const res = await fetch(`/api/materials/${testId}`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    const data = await res.json();

    const material = data.material;
    questions = data.questions || [];

    console.log("QUESTIONS:", questions); // 🔍 DEBUG

    // ================= PASSAGE =================
    let passage = material.content;

     try {
     const obj = JSON.parse(material.content);
     passage = obj.passage || material.content;
     } catch {
     passage = material.content;
    }

    passageEl.innerHTML = `
      <h2>${material.title}</h2>
      <p style="line-height:1.6;">
        ${String(passage).replace(/\n/g, "<br>")}
      </p>
    `;

    // ================= QUESTIONS =================
    container.innerHTML = "";

    questions.forEach((q, index) => {
      const div = document.createElement("div");
      div.className = "question";

      let answerHTML = "";

      const type = (q.type || "").toLowerCase();

      // ✅ INPUT
      if (type === "input") {
        answerHTML = `
          <input type="text" name="q_${q.id}" placeholder="Write answer">
        `;
      }

      // ✅ TRUE / FALSE / NOT GIVEN
      else if (type === "true_false") {
        answerHTML = `
          <label><input type="radio" name="q_${q.id}" value="TRUE"> TRUE</label><br>
          <label><input type="radio" name="q_${q.id}" value="FALSE"> FALSE</label><br>
          <label><input type="radio" name="q_${q.id}" value="NOT GIVEN"> NOT GIVEN</label>
        `;
      }

      // ❗ AGAR OPTIONLAR YO‘Q BO‘LSA → INPUTGA O‘TADI
      else if (!q.option_a && !q.option_b && !q.option_c && !q.option_d) {
        answerHTML = `
          <input type="text" name="q_${q.id}" placeholder="Write answer">
        `;
      }

      // ✅ MCQ (A B C D)
      else {
        answerHTML = ["A","B","C","D"].map(k => `
          <label>
            <input type="radio" name="q_${q.id}" value="${k}">
            ${k}) ${q["option_" + k.toLowerCase()] || ""}
          </label><br>
        `).join("");
      }

      div.innerHTML = `
        <p><b>${index + 1}) ${q.question_text}</b></p>
        <div style="margin-top:8px;">
          ${answerHTML}
        </div>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    container.innerHTML = "Error loading test";
    console.error(err);
  }
}

loadTest();

// ================= SUBMIT =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const answers = questions.map((q) => {
    const elements = document.querySelectorAll(`[name="q_${q.id}"]`);

    let value = "";

    if (!elements.length) {
      return { question_id: q.id, answer: "" };
    }

    // radio bo‘lsa
    if (elements[0].type === "radio") {
      const checked = document.querySelector(`[name="q_${q.id}"]:checked`);
      value = checked ? checked.value : "";
    } 
    // input bo‘lsa
    else {
      value = elements[0].value || "";
    }

    return {
      question_id: q.id,
      answer: value
    };
  });

  try {
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
      <h3>Natija: ${data.score}%</h3>
    `;

  } catch (err) {
    console.error(err);
  }
});