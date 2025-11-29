// === УТИЛІТИ ===
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const storage = {
  get: (key) => JSON.parse(localStorage.getItem(key) || 'null'),
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  clear: () => localStorage.clear()
};

function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  children.forEach(ch => el.appendChild(ch));
  return el;
}

// === 3D-СЦЕНА ===
let scene, camera, renderer, mesh, tooltip, raycaster, mouse;
let permutations = [];

function initScene() {

    if (typeof THREE === 'undefined') {
      alert('Помилка: Three.js не завантажено. Перевірте інтернет або версію.');
      return;
    }
    if (typeof THREE.OrbitControls === 'undefined') {
      alert('Помилка: OrbitControls не завантажено.');
      return;
    }

  const canvas = $('#scene');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf9fafb);

  camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 12);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  });

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 5, 5);
  scene.add(ambient, dir);

  // --- генеруємо вершини ---
  permutations = generatePermutations([1,2,3,4]);
  const positions = new Float32Array(permutations.flatMap(p => {
    const [a,b,c,d] = p;
    return [a+b-5, a+c-5, b+c-5];
  }));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // ребра (жорстко зашиті для S₄)
  const edges = generateEdges();
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(edges.flatMap(idx => [
    positions[idx[0]*3], positions[idx[0]*3+1], positions[idx[0]*3+2],
    positions[idx[1]*3], positions[idx[1]*3+1], positions[idx[1]*3+2]
  ]));
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6 });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  const material = new THREE.PointsMaterial({ color: 0x3b82f6, size: 0.25 });
  mesh = new THREE.Points(geometry, material);
  scene.add(mesh);

  // керування
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;

  // tooltip
  tooltip = createEl('div', { className: 'tooltip', style: 'display:none' });
  document.body.appendChild(tooltip);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  canvas.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / canvas.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);
    if (intersects.length > 0) {
      const idx = intersects[0].index;
      const perm = permutations[idx];
      tooltip.textContent = `(${perm.join(' ')})`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY + 10}px`;
    } else {
      tooltip.style.display = 'none';
    }
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, mesh, controls };
}

// === ПЕРЕСТАНОВКИ ===
function generatePermutations(arr) {
  if (arr.length === 1) return [arr];
  const res = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = generatePermutations(arr.slice(0,i).concat(arr.slice(i+1)));
    for (const p of rest) res.push([arr[i], ...p]);
  }
  return res;
}

// ребра: сусідні транспозиції
function generateEdges() {
  const edges = [];
  for (let i = 0; i < permutations.length; i++) {
    const p = permutations[i];
    for (let pos = 0; pos < 3; pos++) {
      const q = [...p];
      [q[pos], q[pos+1]] = [q[pos+1], q[pos]];
      const j = permutations.findIndex(r => r.every((v,k)=>v===q[k]));
      if (j > i) edges.push([i, j]);
    }
  }
  return edges;
}

// === ТУР ===
const tourStages = [
  { title: "Вершини", text: "Кожна вершина — це перестановка чисел 1,2,3,4. Усього 4! = 24 вершини.", highlight: 'vertices' },
  { title: "Ребра", text: "Ребро з'єднує дві перестановки, що відрізняються транспозицією сусідніх елементів.", highlight: 'edges' },
  { title: "Грані", text: "Є 8 трикутних і 6 чотирикутних граней. Трикутна — це 3-цикл, чотирикутна — дві транспозиції.", highlight: 'faces' },
  { title: "Сусідність", text: "Дві перестановки сусідні, якщо їх можна отримати одна з одної одним обміном сусідніх чисел.", highlight: 'edges' },
  { title: "Центр", text: "Центр многогранника — точка (2.5, 2.5, 2.5).", highlight: 'center' },
  // ще 5 етапів можна додати за потребою...
  { title: "Відстань", text: "Відстань між перестановками вимірюється мінімальною кількістю сусідніх транспозицій, потрібних для переходу між ними.", highlight: 'metric' },
  { title: "Шари", text: "Можна виділити 'шари' відносно перестановки 1234: чим більше елементів стоїть не на своїх місцях, тим далі вершина розташована.", highlight: 'layers' },
  { title: "Симетрії", text: "Многогранник має симетрії, що відповідають перетворенням групи S₄: вони переставляють координати без зміни структури графа.", highlight: 'symmetry' },
  { title: "Шляхи", text: "Будь-який шлях між вершинами — це послідовність обмінів сусідніх елементів. Короткі шляхи відповідають мінімальним перестановкам.", highlight: 'paths' },
  { title: "Орієнтація", text: "Об'ємна модель відображає перестановки у 3D-просторі, де осі відповідають позиціям елементів у перестановці.", highlight: 'orientation' },
];

function startTour({ mesh }) {
  const content = $('#content');
  content.innerHTML = '';
  let idx = storage.get('tourProgress') || 0;

  function showStage(i) {
    if (i >= tourStages.length) {
      content.innerHTML = '<h2>Вітаємо!</h2><p>Ви завершили тур.</p>';
      storage.set('tourProgress', 0);
      return;
    }
    const s = tourStages[i];
    content.innerHTML = `
      <h2>${s.title}</h2>
      <p>${s.text}</p>
      <button class="btn" id="next">Далі</button>
    `;
    $('#next').onclick = () => {
      storage.set('tourProgress', i+1);
      showStage(i+1);
    };
  }
  showStage(idx);
}

// === ТЕСТИ ===
// === ТВОЯ БАЗА ДАНИХ ПИТАНЬ (без змін) ===
const quizDB = [
  { q: "Скільки вершин у трапецієдрі S₄?", a: "24", opts: ["12","24","36","48"] },
  { q: "Що з'єднує ребро?", a: "Транспозиція сусідніх", opts: ["3-цикл","Транспозиція сусідніх","4-цикл","Дві транспозиції"] },
  { q: "Скільки граней має правильний октаедр?", a: "8", opts: ["6","8","10","12"] },
  { q: "Яка фігура є двоїстою до куба?", a: "Октаедр", opts: ["Тетраедр","Октаедр","Ікосаедр","Додекаедр"] },
  { q: "Скільки ребер у тетраедра?", a: "6", opts: ["4","5","6","8"] },
  { q: "Скільки перестановок має група S₅?", a: "120", opts: ["24","60","120","240"] },
  { q: "Що таке цикл у перестановці?", a: "Послідовність елементів, що переходять один в одного", opts: ["Фігура","Числова функція","Послідовність елементів, що переходять один в одного","Вектор"] },
  { q: "Скільки граней у додекаедра?", a: "12", opts: ["8","10","12","14"] },
  { q: "Яка форма грані у правильного ікосаедра?", a: "Рівносторонній трикутник", opts: ["Квадрат","Рівнобічний трикутник","Рівносторонній трикутник","П'ятикутник"] },
  { q: "Як позначається група всіх перестановок n елементів?", a: "Sₙ", opts: ["Aₙ","Sₙ","Pₙ","Gₙ"] },
  { q: "Що таке транспозиція?", a: "Перестановка двох елементів", opts: ["3-цикл","Перестановка двох елементів","Парна перестановка","Фіксація"] },
  { q: "Скільки вершин у куба?", a: "8", opts: ["6","8","10","12"] },
  { q: "Який багатогранник має 20 граней?", a: "Ікосаедр", opts: ["Додекаедр","Октаедр","Ікосаедр","Призма"] },
  { q: "Що утворює 3-цикл?", a: "Перестановку трьох елементів", opts: ["Вектор","Площину","Перестановку трьох елементів","Композицію транспозицій"] },
  { q: "Скільки ребер у додекаедра?", a: "30", opts: ["20","24","30","36"] },
  { q: "Який багатогранник має 4 грані?", a: "Тетраедр", opts: ["Куб","Октаедр","Тетраедр","Призма"] },
  { q: "Який багатогранник є двоїстим до ікосаедра?", a: "Додекаедр", opts: ["Октаедр","Куб","Додекаедр","Тетраедр"] },
  { q: "Що визначає порядок перестановки?", a: "НСК довжин циклів", opts: ["Сума циклів","Добуток циклів","НСК довжин циклів","Кількість фіксацій"] },
  { q: "Скільки парних перестановок у S₄?", a: "12", opts: ["6","12","24","8"] },
  { q: "Що таке фіксація в перестановці?", a: "Елемент, що не змінює позицію", opts: ["Нульовий цикл","Елемент, що не змінює позицію","Дублювання","Точка симетрії"] },
  { q: "Яка геометрична фігура є гранню куба?", a: "Квадрат", opts: ["Трикутник","Квадрат","П'ятикутник","Шестикутник"] },
  { q: "Скільки граней має куб?", a: "6", opts: ["4","5","6","7"] },
  { q: "Який багатогранник має 6 вершин?", a: "Октаедр", opts: ["Куб","Октаедр","Тетраедр","Призма"] },
  { q: "Який цикл має вигляд (1 2 3 4)?", a: "4-цикл", opts: ["3-цикл","4-цикл","2-цикл","Транспозиція"] },
  { q: "Скільки граней у тетраедра?", a: "4", opts: ["3","4","5","6"] },
];


// === МОЯ ДОБАВКА: Функція для перемішування масиву ===
// Використовується щоб питання були в рандомному порядку
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// === ОСНОВНА ФУНКЦІЯ ТЕСТУ (твоя, але покращена) ===
function startQuiz() {
  const content = $('#content');
  content.innerHTML = '';

  let score = 0;
  let qIdx = 0;

  // === МОЯ ДОБАВКА: перемішані питання ===
  const questions = shuffle([...quizDB]);

  // === МОЯ ДОБАВКА: збереження помилок ===
  let wrongAnswers = [];

  function showQ() {

    // === КІНЕЦЬ ТЕСТУ — ВИВІД РЕЗУЛЬТАТІВ ===
    if (qIdx >= questions.length) {

      // === МОЯ ДОБАВКА: генерація списку помилок ===
      let wrongHTML = wrongAnswers.length
        ? `<h3>Ваші помилки:</h3><ul>` +
          wrongAnswers.map(w =>
            `<li><strong>${w.q}</strong><br>
             Ваш варіант: <span style="color:red">${w.user}</span><br>
             Правильна відповідь: <span style="color:green">${w.correct}</span>
            </li>`
          ).join('') +
          `</ul>`
        : `<p>Усі відповіді правильні! 🎉</p>`;

      content.innerHTML = `
        <h2>Результат: ${score}/${questions.length}</h2>
        ${wrongHTML}
        <button class="btn" id="restart">Ще раз</button>
      `;
      $('#restart').onclick = startQuiz;
      return;
    }

    const q = questions[qIdx];

    // === Генерація варіантів відповіді (твій код) ===
    const opts = q.opts.map(o => `
      <label><input type="radio" name="q" value="${o}"> ${o}</label><br>
    `).join('');

    // === МОЯ ДОБАВКА: НУМЕРАЦІЯ ПИТАННЯ (5/25) ===
    content.innerHTML = `
      <p><em>Питання ${qIdx + 1} / ${questions.length}</em></p>
      <p><strong>${q.q}</strong></p>
      ${opts}
      <button class="btn" id="check">Перевірити</button>
    `;

    // === Обробка відповіді (твоя логіка) + моє збереження помилок ===
    $('#check').onclick = () => {
      const sel = $('input[name="q"]:checked');
      if (!sel) return alert('Оберіть варіант');

      if (sel.value === q.a) {
        score++;
      } else {
        // === МОЯ ДОБАВКА: запис неправильної відповіді ===
        wrongAnswers.push({
          q: q.q,
          user: sel.value,
          correct: q.a
        });
      }

      qIdx++;
      showQ();
    };
  }

  showQ();
}
// === ЧАТ-БОТ ===
const botResponses = {
  "скільки вершин": "24 — тому що 4! = 24 перестановки.",
  "що таке ребро": "Ребро з'єднує дві перестановки, які відрізняються транспозицією сусідніх елементів.",
  "скільки граней": "14: 8 трикутних і 6 чотирикутних.",
  "центр": "Центр — точка (2.5, 2.5, 2.5).",
  // додати ще...
};

function initChat() {
  const content = $('#content');
  content.innerHTML = `
    <div id="chatbox" style="height:300px; overflow-y:auto; border:1px solid #ccc; padding:0.5rem; margin-bottom:0.5rem;"></div>
    <input id="msg" placeholder="Запитайте..." style="width:100%; padding:0.5rem;">
    <button class="btn" id="send">Надіслати</button>
  `;
  const box = $('#chatbox'), input = $('#msg');
  $('#send').onclick = () => {
    const txt = input.value.trim().toLowerCase();
    if (!txt) return;
    addMsg(txt, 'user');
    const resp = botResponses[txt] || "Вибачте, я ще не знаю відповіді. Спробуйте тур або тести.";
    setTimeout(() => addMsg(resp, 'bot'), 300);
    input.value = '';
  };
  function addMsg(text, sender) {
    const div = createEl('div', { style: `margin:0.3rem 0; text-align:${sender==='user'?'right':'left'}` });
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }
}

// === ГОЛОВНЕ МЕНЮ ===
document.addEventListener('DOMContentLoaded', () => {
  const three = initScene();

  $$('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      $('#content').innerHTML = '';
      if (mode === 'tour') startTour(three);
      if (mode === 'quiz') startQuiz();
      if (mode === 'chat') initChat();
    });
  });

  $('#clear').addEventListener('click', () => {
    if (confirm('Очистити весь прогрес?')) {
      storage.clear();
      location.reload();
    }
  });
});