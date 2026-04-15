const params = new URLSearchParams(window.location.search);
const testId = params.get("id");

const container = document.getElementById("questionsContainer");
const nav = document.getElementById("questionNav");
const audio = document.getElementById("audioPlayer");

let questions = [];

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

    // 🎧 AUDIO
    try {
      const obj = JSON.parse(material.content);
      audio.src = obj.audio;
    } catch {
      console.log("Audio topilmadi");
    }

    container.innerHTML = "";
    nav.innerHTML = "";

    questions.forEach((q, index) => {
      const qDiv = document.createElement("div");
      qDiv.className = "question";
      qDiv.id = "q" + index;

      let questionText = q.question_text || "";

      // agar ___ bo‘lsa inputni ichiga qo‘yadi
      if (questionText.includes("___")) {
        questionText = questionText.replace(
          "___",
          `<input type="text" name="q_${q.id}" style="width:150px;">`
        );
      } else {
        questionText += `
          <input type="text" name="q_${q.id}" style="margin-left:10px;width:150px;">
        `;
      }

      qDiv.innerHTML = `
        <p>
          <b>${index + 1})</b> 
          ${questionText}
        </p>
      `;

      container.appendChild(qDiv);

      // 🔢 NAV BUTTON
      const btn = document.createElement("button");
      btn.innerText = index + 1;
      btn.className = "nav-btn";              // 👈 class qo‘shildi
      btn.setAttribute("data-qid", q.id);     // 👈 savol ID qo‘shildi

      btn.onclick = () => {
        document.getElementById("q" + index).scrollIntoView({
          behavior: "smooth"
        });
      };

      nav.appendChild(btn);
    });

  } catch (err) {
    container.innerHTML = "Error loading test";
    console.error(err);
  }
}

loadTest();


// ✅ SUBMIT (INPUT + VARIANT + NAV BUTTON)
document.getElementById("testForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const answers = questions.map((q) => {
    const input = document.querySelector(`[name="q_${q.id}"]`);
    let answer = "";

    if (input) {
      answer = input.value || "";
    } else {
      const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
      answer = selected ? selected.value : "";
    }

    return {
      question_id: q.id,
      answer
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

    // ✅ Ranglash
    if (Array.isArray(data.results)) {
      data.results.forEach(r => {
        // input test
        const input = document.querySelector(`[name="q_${r.question_id}"]`);
        if (input) {
          if (r.is_correct) {
            input.classList.add("correct");
          } else {
            input.classList.add("wrong");
          }
        }

        // multiple-choice test
        const options = document.querySelectorAll(`input[name="q_${r.question_id}"]`);
        options.forEach(opt => {
          if (opt.value === r.correct_option) {
            opt.parentElement.classList.add("correct");
          } else if (opt.checked) {
            opt.parentElement.classList.add("wrong");
          }
        });

        // ✅ Navigatsiya tugmasi ranglash
        const navBtn = document.querySelector(`button[data-qid="${r.question_id}"]`);
        if (navBtn) {
          navBtn.classList.remove("correct", "wrong");
          navBtn.classList.add(r.is_correct ? "correct" : "wrong");
        }
      });
    }

  } catch (err) {
    console.error(err);
  }
});
