const storageKey = "todo-desk-state";

const state = {
  todos: [],
  filter: "all",
  query: "",
  theme: "light",
};

const els = {
  form: document.querySelector("#todoForm"),
  taskInput: document.querySelector("#taskInput"),
  dueInput: document.querySelector("#dueInput"),
  priorityInput: document.querySelector("#priorityInput"),
  todoList: document.querySelector("#todoList"),
  template: document.querySelector("#todoTemplate"),
  filterButtons: document.querySelectorAll(".filter-button"),
  searchInput: document.querySelector("#searchInput"),
  clearDone: document.querySelector("#clearDone"),
  themeToggle: document.querySelector("#themeToggle"),
  listTitle: document.querySelector("#listTitle"),
  listSubtitle: document.querySelector("#listSubtitle"),
  emptyState: document.querySelector("#emptyState"),
  progressMeter: document.querySelector("#progressMeter"),
  progressText: document.querySelector("#progressText"),
  todayLabel: document.querySelector("#todayLabel"),
  totalCount: document.querySelector("#totalCount"),
  openCount: document.querySelector("#openCount"),
  dueCount: document.querySelector("#dueCount"),
  doneCount: document.querySelector("#doneCount"),
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatDate = (isoDate) => {
  if (!isoDate) return "No date";
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const seedTodos = () => [
  {
    id: uid(),
    text: "Sketch the next version of the todo flow",
    done: false,
    due: todayIso(),
    priority: "high",
    createdAt: Date.now(),
  },
  {
    id: uid(),
    text: "Try the search and filters",
    done: false,
    due: "",
    priority: "normal",
    createdAt: Date.now() - 1,
  },
  {
    id: uid(),
    text: "Mark one item complete",
    done: true,
    due: todayIso(),
    priority: "low",
    createdAt: Date.now() - 2,
  },
];

const save = () => {
  localStorage.setItem(storageKey, JSON.stringify({ todos: state.todos, theme: state.theme }));
};

const load = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    state.todos = Array.isArray(saved?.todos) ? saved.todos : seedTodos();
    state.theme = saved?.theme === "dark" ? "dark" : "light";
  } catch {
    state.todos = seedTodos();
  }
};

const filteredTodos = () => {
  const query = state.query.trim().toLowerCase();
  return state.todos
    .filter((todo) => {
      if (state.filter === "today") return todo.due === todayIso();
      if (state.filter === "active") return !todo.done;
      if (state.filter === "done") return todo.done;
      return true;
    })
    .filter((todo) => !query || todo.text.toLowerCase().includes(query))
    .sort((a, b) => Number(a.done) - Number(b.done) || priorityRank(b.priority) - priorityRank(a.priority) || b.createdAt - a.createdAt);
};

const priorityRank = (priority) => ({ low: 0, normal: 1, high: 2 })[priority] ?? 1;

const setTheme = (theme) => {
  state.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  els.themeToggle.innerHTML = `<svg aria-hidden="true"><use href="#icon-${theme === "dark" ? "sun" : "moon"}" /></svg>`;
  save();
};

const updateStats = () => {
  const total = state.todos.length;
  const done = state.todos.filter((todo) => todo.done).length;
  const open = total - done;
  const due = state.todos.filter((todo) => !todo.done && todo.due && todo.due <= todayIso()).length;
  const progress = total ? Math.round((done / total) * 100) : 0;

  els.totalCount.textContent = total;
  els.openCount.textContent = open;
  els.dueCount.textContent = due;
  els.doneCount.textContent = done;
  els.progressText.textContent = `${progress}%`;
  els.progressMeter.style.strokeDashoffset = `${302 - (302 * progress) / 100}`;
};

const updateHeading = (visibleCount) => {
  const labels = {
    all: "All tasks",
    today: "Today",
    active: "Active tasks",
    done: "Completed tasks",
  };
  els.listTitle.textContent = labels[state.filter];
  els.listSubtitle.textContent = visibleCount === 1 ? "1 task shown" : `${visibleCount} tasks shown`;
};

const renderTodo = (todo) => {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const editInput = node.querySelector(".edit-input");
  const completeButton = node.querySelector(".complete-button");
  const editButton = node.querySelector(".edit-button");
  const deleteButton = node.querySelector(".delete-button");
  const priorityPill = node.querySelector(".priority-pill");
  const duePill = node.querySelector(".due-pill");
  const dueText = duePill.querySelector("span");

  node.dataset.id = todo.id;
  node.classList.toggle("done", todo.done);
  editInput.value = todo.text;
  editInput.readOnly = true;

  priorityPill.textContent = todo.priority;
  priorityPill.classList.toggle("high", todo.priority === "high");
  priorityPill.classList.toggle("low", todo.priority === "low");

  dueText.textContent = formatDate(todo.due);
  duePill.classList.toggle("overdue", Boolean(todo.due && todo.due < todayIso() && !todo.done));

  completeButton.addEventListener("click", () => updateTodo(todo.id, { done: !todo.done }));
  deleteButton.addEventListener("click", () => deleteTodo(todo.id));
  editButton.addEventListener("click", () => {
    editInput.readOnly = false;
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  });
  editInput.addEventListener("blur", () => finishEdit(todo.id, editInput));
  editInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") editInput.blur();
    if (event.key === "Escape") {
      editInput.value = todo.text;
      editInput.blur();
    }
  });

  return node;
};

const render = () => {
  const todos = filteredTodos();
  els.todoList.replaceChildren(...todos.map(renderTodo));
  els.emptyState.classList.toggle("visible", todos.length === 0);
  els.emptyState.setAttribute("aria-hidden", String(todos.length !== 0));
  updateStats();
  updateHeading(todos.length);
};

const addTodo = (event) => {
  event.preventDefault();
  const text = els.taskInput.value.trim();
  if (!text) return;

  state.todos.unshift({
    id: uid(),
    text,
    done: false,
    due: els.dueInput.value,
    priority: els.priorityInput.value,
    createdAt: Date.now(),
  });

  els.form.reset();
  els.priorityInput.value = "normal";
  els.taskInput.focus();
  save();
  render();
};

const updateTodo = (id, changes) => {
  state.todos = state.todos.map((todo) => (todo.id === id ? { ...todo, ...changes } : todo));
  save();
  render();
};

const deleteTodo = (id) => {
  state.todos = state.todos.filter((todo) => todo.id !== id);
  save();
  render();
};

const finishEdit = (id, input) => {
  const text = input.value.trim();
  input.readOnly = true;
  if (!text) {
    deleteTodo(id);
    return;
  }
  updateTodo(id, { text });
};

els.form.addEventListener("submit", addTodo);
els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});
els.clearDone.addEventListener("click", () => {
  state.todos = state.todos.filter((todo) => !todo.done);
  save();
  render();
});
els.themeToggle.addEventListener("click", () => {
  setTheme(state.theme === "dark" ? "light" : "dark");
});

els.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    els.filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

els.todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
}).format(new Date());

load();
setTheme(state.theme);
render();
