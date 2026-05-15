const API_BASE = "https://auraielts.onrender.com";

let TIME_LEFT = 60 * 60; // UMUMIY 60 MINUT
let TIMER = null;
let TASK_ID = null;

let currentTask = 1;

let currentFontSize = 20;

/* ================= DATE ================= */

function setCurrentDate(){

    const date = new Date();

    const options = {
        year:"numeric",
        month:"long",
        day:"numeric"
    };

    document.getElementById("currentDate").innerText =
        date.toLocaleDateString("en-US", options);
}

/* ================= TIMER ================= */

function startTimer(){

    if(TIMER) clearInterval(TIMER);

    TIMER = setInterval(() => {

        let minutes = Math.floor(TIME_LEFT / 60);
        let seconds = TIME_LEFT % 60;

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        const formatted = `${minutes}:${seconds}`;

        document.getElementById("timer").innerText = formatted;
        document.getElementById("topTimer").innerText = formatted;

        if(TIME_LEFT <= 0){

            clearInterval(TIMER);

            alert("Time is over!");

            submitEssay();

            return;
        }

        TIME_LEFT--;

    },1000);
}

/* ================= WORD COUNT ================= */

function countWords(text){

    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}

function updateWordCount(){

    const textarea =
        document.getElementById("essay");

    const words =
        countWords(textarea.value);

    document.getElementById("wordCount").innerText =
        words;

    document.getElementById("footerWords").innerText =
        words;

    localStorage.setItem(
        `writing_draft_task_${currentTask}`,
        textarea.value
    );
}

function bindWordCounter(){

    const textarea =
        document.getElementById("essay");

    textarea.addEventListener(
        "input",
        updateWordCount
    );
}

/* ================= TASK SWITCH ================= */

function switchTask(taskNumber) {
    const textarea = document.getElementById("essay");

    // 1. Joriy yozilayotgan matnni draft sifatida saqlash
    localStorage.setItem(`writing_draft_task_${currentTask}`, textarea.value);

    // 2. Qaysi taskga o'tayotganimizni belgilash
    currentTask = taskNumber;

    // 3. Tugmalarning vizual holatini o'zgartirish
    document.getElementById("task1Btn").classList.toggle("active", taskNumber === 1);
    document.getElementById("task2Btn").classList.toggle("active", taskNumber === 2);

    // 4. BAZADAN kelgan yangi savol matnlarini chiqarish
    // taskNumber 1 bo'lsa 0-indeks, 2 bo'lsa 1-indeks olinadi
    displayTaskData(taskNumber - 1);

    // 5. Avval yozilgan draft bo'lsa, uni textarea'ga qaytarish
    textarea.value = localStorage.getItem(`writing_draft_task_${taskNumber}`) || "";
    updateWordCount();
}

/* ================= TOOLBAR ================= */

function setupToolbar(){

    const textarea =
        document.getElementById("essay");

    /* BOLD */

    document
    .getElementById("boldBtn")
    .addEventListener("click",function(){

        this.classList.toggle("active");

        textarea.style.fontWeight =
            textarea.style.fontWeight === "bold"
            ? "normal"
            : "bold";
    });

    /* ITALIC */

    document
    .getElementById("italicBtn")
    .addEventListener("click",function(){

        this.classList.toggle("active");

        textarea.style.fontStyle =
            textarea.style.fontStyle === "italic"
            ? "normal"
            : "italic";
    });

    /* UNDERLINE */

    document
    .getElementById("underlineBtn")
    .addEventListener("click",function(){

        this.classList.toggle("active");

        textarea.style.textDecoration =
            textarea.style.textDecoration === "underline"
            ? "none"
            : "underline";
    });

    /* FONT + */

    document
    .getElementById("fontPlus")
    .addEventListener("click",() => {

        currentFontSize += 2;

        textarea.style.fontSize =
            currentFontSize + "px";
    });

    /* FONT - */

    document
    .getElementById("fontMinus")
    .addEventListener("click",() => {

        if(currentFontSize > 14){

            currentFontSize -= 2;

            textarea.style.fontSize =
                currentFontSize + "px";
        }
    });

    /* FULLSCREEN */

    document
    .getElementById("fullscreenBtn")
    .addEventListener("click",() => {

        if(!document.fullscreenElement){

            document.documentElement.requestFullscreen();

        }else{

            document.exitFullscreen();
        }
    });
}

/* ================= AI ================= */

function showAiMessage(){

    alert(
        "AI Check qismi hali joriy etilmadi.\n\nYaqin orada qo'shiladi 🚀"
    );
}

/* ================= LOAD TASK ================= */

async function loadTask() {
    const params = new URLSearchParams(window.location.search);
    const SET_ID = params.get("id"); // URL'dan kelgan ID endi set_id hisoblanadi
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please login again");
        window.location.href = "index.html";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/writing/sets/${SET_ID}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!res.ok) throw new Error("Failed to load tasks");

        const data = await res.json();
        allTasks = data.tasks; // Task 1 va Task 2 massivga tushdi

        // Sahifa ochilganda avtomatik Task 1 ni ko'rsatish
        displayTaskData(0); 

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// Ma'lumotlarni ekranga chiqaruvchi yordamchi funksiya
function displayTaskData(index) {
    const task = allTasks[index];
    if (!task) return;

    TASK_ID = task.id; // Submit qilishda kerak bo'ladigan bazadagi ID
    document.getElementById("title").innerText = task.title || "No Title";
    document.getElementById("prompt").innerHTML = task.prompt || "No Prompt";
    
    const minWords = task.min_words || 250;
    document.getElementById("minWords").innerText = minWords;
    document.getElementById("minimumWords").innerText = minWords;
}

/* ================= SUBMIT ================= */

async function submitEssay(){

    const essay =
        document.getElementById("essay").value;

    const token =
        localStorage.getItem("token");

    if(!essay.trim()){

        alert("Please write your essay");

        return;
    }

    try{

        const res = await fetch(
            `${API_BASE}/api/writing/submit`,
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json",
                    "Authorization":`Bearer ${token}`
                },
                body:JSON.stringify({
                    task_id:TASK_ID,
                    essay_text:essay
                })
            }
        );

        if(res.ok){

            localStorage.removeItem(
                `writing_draft_task_${currentTask}`
            );

            alert("Essay submitted successfully!");

            window.location.href = "index.html";

        }else{

            alert("Submit failed");
        }

    }catch(err){

        console.error(err);

        alert("Server error");
    }
}

/* ================= BACK ================= */

function goBack(){

    window.location.href = "index.html";
}

/* ================= INIT ================= */

document
.getElementById("task1Btn")
.addEventListener("click",() => switchTask(1));

document
.getElementById("task2Btn")
.addEventListener("click",() => switchTask(2));

setCurrentDate();

bindWordCounter();

setupToolbar();

loadTask();

startTimer();