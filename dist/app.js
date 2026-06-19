const STORAGE_KEY = "barber-premium";
const AUTH_KEY = "barber-auth";
let clientes = [];
let editIndex = null;
let currentUser = null;

function normalizePhone(value) {
  return (value || "").replace(/\D/g, "");
}

function isFirebaseReady() {
  return (
    typeof window.db !== "undefined" &&
    window.db &&
    window.firebaseConfig &&
    window.firebaseConfig.apiKey &&
    !window.firebaseConfig.apiKey.includes("SUA_API_KEY")
  );
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function syncToFirebase() {
  if (!isFirebaseReady()) return;

  const batch = [];

  for (const cliente of clientes) {
    const id = cliente.id || generateId();
    const docData = { ...cliente, id };

    if (!cliente.id) {
      cliente.id = id;
    }

    batch.push(
      window.db.collection("clientes").doc(id).set(docData)
    );
  }

  await Promise.all(batch);
}

function formatDateTime(value) {
  if (!value) return "Sem horário";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function setAuthMessage(message, isError = false) {
  const element = document.getElementById("authMessage");
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#fca5a5" : "#86efac";
}

function showAuthScreen() {
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function showAppScreen() {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
}

function logout() {
  currentUser = null;
  localStorage.removeItem(AUTH_KEY);
  showAuthScreen();
  setAuthMessage("Você saiu da conta.");
}

function saveSession(user) {
  currentUser = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  document.getElementById("userBadge").textContent = user.name || user.email;
  showAppScreen();
}

function toggleAuthMode(mode) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginBtn = document.getElementById("showLoginBtn");
  const registerBtn = document.getElementById("showRegisterBtn");

  if (mode === "register") {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    loginBtn.classList.remove("active");
    registerBtn.classList.add("active");
  } else {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    loginBtn.classList.add("active");
    registerBtn.classList.remove("active");
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function registerUser(name, email, password, confirmPassword) {
  if (!name || !email || !password || !confirmPassword) {
    setAuthMessage("Preencha todos os campos.", true);
    return;
  }

  if (!validateEmail(email)) {
    setAuthMessage("Informe um e-mail válido.", true);
    return;
  }

  if (password.length < 6) {
    setAuthMessage("A senha precisa ter pelo menos 6 caracteres.", true);
    return;
  }

  if (password !== confirmPassword) {
    setAuthMessage("As senhas não coincidem.", true);
    return;
  }

  const users = JSON.parse(localStorage.getItem("barber-users") || "[]");
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    setAuthMessage("Este e-mail já está cadastrado.", true);
    return;
  }

  const user = { name, email, password };
  users.push(user);
  localStorage.setItem("barber-users", JSON.stringify(users));
  setAuthMessage("Conta criada com sucesso! Faça login agora.");
  toggleAuthMode("login");
}

function loginUser(email, password) {
  if (!email || !password) {
    setAuthMessage("Informe e-mail e senha.", true);
    return;
  }

  const users = JSON.parse(localStorage.getItem("barber-users") || "[]");
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    setAuthMessage("E-mail ou senha inválidos.", true);
    return;
  }

  saveSession(user);
  setAuthMessage("");
}

function getStatusClass(status) {
  const map = {
    Pendente: "status-pending",
    Confirmado: "status-confirmed",
    Concluído: "status-done"
  };
  return map[status] || "";
}

async function saveClient() {
  const nome = document.getElementById("nome").value.trim();
  const tel = normalizePhone(document.getElementById("tel").value);
  const servico = document.getElementById("servico").value.trim();
  const horario = document.getElementById("horario").value;
  const status = document.getElementById("status").value;

  if (!nome || !tel) return;

  const cliente = {
    nome,
    tel,
    servico,
    horario,
    status
  };

  if (editIndex !== null) {
    clientes[editIndex] = { ...clientes[editIndex], ...cliente };
  } else {
    clientes.push({ ...cliente, id: generateId() });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
  await syncToFirebase();
  resetForm();
  render();
}

function resetForm() {
  document.getElementById("clientForm").reset();
  document.getElementById("status").value = "Pendente";
  document.getElementById("formTitle").textContent = "➕ Novo Cliente";
  document.getElementById("saveBtn").textContent = "Salvar cliente";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  editIndex = null;
}

function editClient(index) {
  const cliente = clientes[index];
  if (!cliente) return;

  document.getElementById("nome").value = cliente.nome;
  document.getElementById("tel").value = cliente.tel;
  document.getElementById("servico").value = cliente.servico || "";
  document.getElementById("horario").value = cliente.horario || "";
  document.getElementById("status").value = cliente.status || "Pendente";

  editIndex = index;
  document.getElementById("formTitle").textContent = "✏️ Editar Cliente";
  document.getElementById("saveBtn").textContent = "Atualizar cliente";
  document.getElementById("cancelEditBtn").classList.remove("hidden");
  document.getElementById("nome").focus();
}

function cancelEdit() {
  resetForm();
}

async function deleteClient(index) {
  const cliente = clientes[index];
  if (!cliente) return;

  const confirmar = confirm(`Excluir ${cliente.nome} da lista?`);
  if (!confirmar) return;

  clientes.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));

  if (isFirebaseReady() && cliente.id) {
    await window.db.collection("clientes").doc(cliente.id).delete();
  }

  render();
}

function focusClientForm() {
  document.getElementById("nome").focus();
}

function renderDashboard() {
  const total = clientes.length;
  const hoje = clientes.filter((cliente) => {
    if (!cliente.horario) return false;
    const data = new Date(cliente.horario);
    const hojeDate = new Date();
    return data.getDate() === hojeDate.getDate() &&
      data.getMonth() === hojeDate.getMonth() &&
      data.getFullYear() === hojeDate.getFullYear();
  }).length;
  const pendentes = clientes.filter((cliente) => cliente.status !== "Concluído").length;
  const concluidos = clientes.filter((cliente) => cliente.status === "Concluído").length;

  document.getElementById("totalClientes").textContent = total;
  document.getElementById("agendamentosHoje").textContent = hoje;
  document.getElementById("pendentes").textContent = pendentes;
  document.getElementById("concluidos").textContent = concluidos;
}

function render() {
  const lista = document.getElementById("lista");
  const select = document.getElementById("clientes");

  lista.innerHTML = "";
  select.innerHTML = "";

  if (!clientes.length) {
    lista.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">Nenhum cliente cadastrado ainda.</td>
      </tr>
    `;
    select.innerHTML = `<option value="">Nenhum cliente</option>`;
    renderDashboard();
    return;
  }

  clientes.forEach((cliente, index) => {
    const statusClass = getStatusClass(cliente.status || "Pendente");

    lista.innerHTML += `
      <tr>
        <td>
          <strong>${cliente.nome}</strong>
        </td>
        <td>${cliente.tel}</td>
        <td>${cliente.servico || "—"}</td>
        <td>${formatDateTime(cliente.horario)}</td>
        <td><span class="status-pill ${statusClass}">${cliente.status || "Pendente"}</span></td>
        <td>
          <button class="btn btn-small btn-secondary" onclick="editClient(${index})">Editar</button>
          <button class="btn btn-small btn-danger" onclick="deleteClient(${index})">Excluir</button>
        </td>
      </tr>
    `;

    select.innerHTML += `<option value="${index}">${cliente.nome}</option>`;
  });

  renderDashboard();
}

function sendWhats() {
  const select = document.getElementById("clientes");
  const i = select.value;

  if (i === "" || !clientes[i]) {
    alert("Selecione um cliente antes de enviar a mensagem.");
    return;
  }

  const cliente = clientes[i];
  const text = document.getElementById("msg").value;
  const url = `https://wa.me/55${cliente.tel}?text=${encodeURIComponent(text)}`;

  window.open(url, "_blank");
}

async function bootstrap() {
  const storedUser = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  if (storedUser) {
    currentUser = storedUser;
    document.getElementById("userBadge").textContent = storedUser.name || storedUser.email;
    showAppScreen();
  } else {
    showAuthScreen();
  }

  document.getElementById("showLoginBtn").addEventListener("click", () => toggleAuthMode("login"));
  document.getElementById("showRegisterBtn").addEventListener("click", () => toggleAuthMode("register"));

  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    loginUser(
      document.getElementById("loginEmail").value,
      document.getElementById("loginPassword").value
    );
  });

  document.getElementById("registerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    registerUser(
      document.getElementById("registerName").value,
      document.getElementById("registerEmail").value,
      document.getElementById("registerPassword").value,
      document.getElementById("registerConfirm").value
    );
  });

  try {
    if (isFirebaseReady()) {
      const snapshot = await window.db.collection("clientes").get();
      clientes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } else {
      clientes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    }
  } catch (error) {
    console.warn("Falha ao carregar dados do Firebase, usando localStorage.", error);
    clientes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  }

  resetForm();
  render();
}

bootstrap();