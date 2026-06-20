// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAU4RPw-GEPdWhXgOEcuBHvpsqAoS9OBPA",
  authDomain: "atendezap-barber.firebaseapp.com",
  projectId: "atendezap-barber",
  storageBucket: "atendezap-barber.firebasestorage.app",
  messagingSenderId: "463357013064",
  appId: "1:463357013064:web:7f7f52df31b5250cdd3c7d",
  measurementId: "G-DSQVL423LZ"
};

// Inicializa a conexão
window.firebaseConfig = firebaseConfig;
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();

// ==========================================
// 2. LÓGICA DO APLICATIVO (SaaS)
// ==========================================
let clientes = [];
let editIndex = null;
let currentUser = null;
let barbeiros = [];

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
  if (!isFirebaseReady() || !currentUser) return;

  const batch = [];
  const uid = currentUser.uid;

  for (const cliente of clientes) {
    const id = cliente.id || generateId();
    // Vincula o cliente à barbearia atual
    const docData = { ...cliente, id, userId: uid };

    if (!cliente.id) {
      cliente.id = id;
    }

    batch.push(
      window.db.collection("clientes").doc(id).set(docData)
    );
  }

  await Promise.all(batch);
}

async function loadClientesFromFirebase() {
  if (!isFirebaseReady() || !currentUser) return;

  try {
    const snapshot = await window.db.collection("clientes")
      .where("userId", "==", currentUser.uid)
      .get();

    clientes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    render();
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
  }
}

function formatDateTime(value) {
  if (!value) return "Sem horário";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function isSameDay(a, b) {
  return a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

function isSameMonth(a, b) {
  return a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
}

function formatCurrency(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
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
  if (isFirebaseReady()) {
    firebase.auth().signOut().then(() => {
      currentUser = null;
      clientes = [];
      render();
      showAuthScreen();
      setAuthMessage("Você saiu da conta.");
    });
  }
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

  if (isFirebaseReady()) {
    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        return userCredential.user.updateProfile({
          displayName: name
        });
      })
      .then(() => {
        setAuthMessage("Conta criada com sucesso!");
      })
      .catch((error) => {
        setAuthMessage("Erro: " + error.message, true);
      });
  } else {
    setAuthMessage("Erro: Configure o Firebase para criar contas.", true);
  }
}

function loginUser(email, password) {
  if (!email || !password) {
    setAuthMessage("Informe e-mail e senha.", true);
    return;
  }

  if (isFirebaseReady()) {
    firebase.auth().signInWithEmailAndPassword(email, password)
      .catch((error) => {
        setAuthMessage("E-mail ou senha inválidos.", true);
      });
  }
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
  const barbeiro = document.getElementById("barbeiro").value;
  const valor = parseFloat(document.getElementById("valor").value) || 0;
  const horario = document.getElementById("horario").value;
  const status = document.getElementById("status").value;

  if (!nome || !tel) return;

  const cliente = {
    nome,
    tel,
    servico,
    barbeiro,
    valor,
    horario,
    status
  };

  if (editIndex !== null) {
    clientes[editIndex] = {
      ...clientes[editIndex],
      ...cliente
    };
  } else {
    clientes.push({
      ...cliente,
      id: generateId(),
      userId: currentUser ? currentUser.uid : null
    });
  }

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

  document.getElementById("nome").value = cliente.nome || "";
  document.getElementById("tel").value = cliente.tel || "";
  document.getElementById("servico").value = cliente.servico || "";
  document.getElementById("barbeiro").value = cliente.barbeiro || "";
  document.getElementById("valor").value = cliente.valor || "";
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

function concluirAtendimento(index) {
  const cliente = clientes[index];
  if (!cliente) return;

  clientes[index] = {
    ...cliente,
    status: "Concluído"
  };

  render();
}

async function deleteClient(index) {
  const cliente = clientes[index];
  if (!cliente) return;

  const confirmar = confirm(`Excluir ${cliente.nome} da lista?`);
  if (!confirmar) return;

  clientes.splice(index, 1);

  if (isFirebaseReady() && cliente.id) {
    await window.db.collection("clientes").doc(cliente.id).delete();
  }

  render();
}

function focusClientForm() {
  document.getElementById("nome").focus();
}
function addBarbeiro() {

  const input = document.getElementById("novoBarbeiro");

  const nome = input.value.trim();

  if (!nome) return;

  barbeiros.push(nome);

  renderBarbeiros();

  input.value = "";
}
function renderBarbeiros() {

  const lista = document.getElementById("listaBarbeiros");

  const select = document.getElementById("barbeiro");

  lista.innerHTML = "";

  select.innerHTML =
    '<option value="">Selecione o barbeiro</option>';

  barbeiros.forEach((barbeiro, index) => {

    lista.innerHTML += `
      <div class="barbeiro-card">

        <div class="barbeiro-info">

          <span class="barbeiro-name">
            ${barbeiro}
          </span>

          <button
            class="btn btn-danger btn-small"
            onclick="removeBarbeiro(${index})">

            Excluir

          </button>

        </div>

      </div>
    `;

    select.innerHTML += `
      <option value="${barbeiro}">
        ${barbeiro}
      </option>
    `;

  });

}
function removeBarbeiro(index) {

  barbeiros.splice(index, 1);

  renderBarbeiros();

}

function renderDashboard() {
  const hoje = clientes.filter((cliente) => {
    const data = parseDate(cliente.horario);
    return data && isSameDay(data, new Date());
  }).length;

  const pendentes = clientes.filter((cliente) => cliente.status !== "Concluído").length;
  const concluidos = clientes.filter((cliente) => cliente.status === "Concluído").length;

  const faturamentoHoje = clientes.reduce((total, cliente) => {
    const data = parseDate(cliente.horario);
    if (!data || !isSameDay(data, new Date()) || cliente.status !== "Concluído") {
      return total;
    }
    return total + (Number(cliente.valor) || 0);
  }, 0);

  const faturamentoMes = clientes.reduce((total, cliente) => {
    const data = parseDate(cliente.horario);
    if (!data || !isSameMonth(data, new Date()) || cliente.status !== "Concluído") {
      return total;
    }
    return total + (Number(cliente.valor) || 0);
  }, 0);

  document.getElementById("totalClientes").textContent = clientes.length;
  document.getElementById("agendamentosHoje").textContent = hoje;
  document.getElementById("pendentes").textContent = pendentes;
  document.getElementById("concluidos").textContent = concluidos;
  document.getElementById("faturamentoHoje").textContent = formatCurrency(faturamentoHoje);
  document.getElementById("faturamentoMes").textContent = formatCurrency(faturamentoMes);
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

<td>
${cliente.tel}
</td>

<td>
${cliente.servico || "-"}
</td>

<td>
${cliente.barbeiro || "-"}
</td>

<td>
R$ ${Number(cliente.valor || 0).toFixed(2)}
</td>

<td>
${formatDateTime(cliente.horario)}
</td>

<td>
<span class="status-pill ${statusClass}">
${cliente.status || "Pendente"}
</span>
</td>

<td>

<button
class="btn btn-small btn-secondary"
onclick="editClient(${index})">

Editar

</button>

<button
class="btn btn-small btn-success"
onclick="concluirAtendimento(${index})">

Concluir

</button>

<button
class="btn btn-small btn-danger"
onclick="deleteClient(${index})">

Excluir

</button>

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

function bootstrap() {
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

  if (isFirebaseReady()) {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        document.getElementById("userBadge").textContent = user.displayName || user.email;
        showAppScreen();
        loadClientesFromFirebase();
      } else {
        currentUser = null;
        showAuthScreen();
      }
    });
  } else {
    setAuthMessage("Aviso: Conecte o Firebase para habilitar o login.", true);
  }

  resetForm();
  render();
}

bootstrap();