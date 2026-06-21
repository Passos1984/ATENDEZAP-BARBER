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
const STORAGE_KEY = "barber-premium";
let clientes = [];
let editIndex = null;
let currentUser = null;
let barbeiros = [];
let planoAtual = 1;
let trialStart = null;

const DIAS_TRIAL = 7;

const PLANOS = {
    1: { nome: "Essencial", limite: 2, preco: 49.90 },
    2: { nome: "Profissional", limite: 4, preco: 99.90 },
    3: { nome: "Premium", limite: Infinity, preco: 169.90 }
};

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

function diasRestantesTrial() {
    if (!trialStart) return null;

    const inicio = new Date(trialStart);
    if (isNaN(inicio.getTime())) return null;

    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + DIAS_TRIAL);

    const hoje = new Date();
    const msRestante = fim.setHours(23, 59, 59, 999) - hoje.getTime();
    const dias = Math.ceil(msRestante / (1000 * 60 * 60 * 24));

    return Math.max(dias, 0);
}

function renderTrialBadge() {
    const badge = document.getElementById("trialBadge");
    if (!badge) return;

    const dias = diasRestantesTrial();

    if (dias === null) {
        badge.classList.add("hidden");
        return;
    }

    badge.classList.remove("hidden");

    if (dias > 0) {
        badge.textContent = `🎁 ${dias} dia${dias === 1 ? "" : "s"} de teste grátis restante${dias === 1 ? "" : "s"}`;
        badge.classList.remove("trial-ended");
    } else {
        badge.textContent = "Teste grátis encerrado";
        badge.classList.add("trial-ended");
    }
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

async function loadBarbeariaFromFirebase() {
    if (!isFirebaseReady() || !currentUser) return;

    try {
        const ref = window.db.collection("barbearias").doc(currentUser.uid);
        const doc = await ref.get();

        if (doc.exists) {
            const data = doc.data();
            planoAtual = data.plano || 1;
            barbeiros = data.barbeiros || [];
            trialStart = data.trialStart || null;

            if (!trialStart) {
                // Conta antiga sem trial registrado: inicia o teste grátis agora
                trialStart = new Date().toISOString();
                await ref.set({ trialStart }, { merge: true });
            }
        } else {
            // Conta antiga sem documento de barbearia: cria um com plano padrão
            planoAtual = 1;
            barbeiros = [];
            trialStart = new Date().toISOString();
            await ref.set({
                nome: currentUser.displayName || "",
                email: currentUser.email || "",
                plano: planoAtual,
                barbeiros: barbeiros,
                trialStart: trialStart
            });
        }

        renderBarbeiros();
        renderPlano();
        renderTrialBadge();
    } catch (error) {
        console.error("Erro ao carregar dados da barbearia:", error);
    }
}

async function syncBarbearia() {
    if (!isFirebaseReady() || !currentUser) return;

    try {
        await window.db.collection("barbearias").doc(currentUser.uid).set({
            nome: currentUser.displayName || "",
            email: currentUser.email || "",
            plano: planoAtual,
            barbeiros: barbeiros
        }, { merge: true });
    } catch (error) {
        console.error("Erro ao salvar dados da barbearia:", error);
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
            barbeiros = [];
            planoAtual = 1;
            trialStart = null;
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
                }).then(() => userCredential.user);
            })
            .then((user) => {
                return window.db.collection("barbearias").doc(user.uid).set({
                    nome: name,
                    email: email,
                    plano: 1,
                    barbeiros: [],
                    trialStart: new Date().toISOString()
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
    document.getElementById("formTitle").textContent = "➕ Novo Agendamento";
    document.getElementById("saveBtn").textContent = "Salvar";
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
    document.getElementById("formTitle").textContent = "✏️ Editar Agendamento";
    document.getElementById("saveBtn").textContent = "Atualizar";
    document.getElementById("cancelEditBtn").classList.remove("hidden");
    document.getElementById("nome").focus();
}

function cancelEdit() {
    resetForm();
}

async function concluirAtendimento(index) {
    const cliente = clientes[index];
    if (!cliente) return;

    clientes[index] = {
        ...cliente,
        status: "Concluído"
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
    await syncToFirebase();
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
    switchView('agendamentos');
    document.querySelectorAll('.menu-item').forEach((menu) => {
        menu.classList.toggle('active', menu.dataset.view === 'agendamentos');
    });
    document.getElementById("nome").focus();
}
async function addBarbeiro() {

    const input = document.getElementById("novoBarbeiro");

    const nome = input.value.trim();

    if (!nome) return;

    const limite = PLANOS[planoAtual].limite;

    if (barbeiros.length >= limite) {
        alert(`Seu plano (${PLANOS[planoAtual].nome}) permite no máximo ${limite} barbeiro(s). Faça upgrade para cadastrar mais.`);
        return;
    }

    barbeiros.push(nome);

    await syncBarbearia();
    renderBarbeiros();

    input.value = "";
}
function renderBarbeiros() {

    const lista = document.getElementById("listaBarbeiros");

    const select = document.getElementById("barbeiro");

    if (!lista || !select) return;

    lista.innerHTML = "";

    select.innerHTML =
        '<option value="">Selecione o barbeiro</option>';

    const limite = PLANOS[planoAtual].limite;
    const limiteAtingido = barbeiros.length >= limite;

    const usageEl = document.getElementById("barbeirosUsage");
    if (usageEl) {
        const limiteTexto = limite === Infinity ? "ilimitado" : limite;
        usageEl.textContent = `${barbeiros.length} de ${limiteTexto} barbeiro(s) usados — Plano ${PLANOS[planoAtual].nome}`;
        usageEl.style.color = limiteAtingido && limite !== Infinity ? "#fca5a5" : "#94a3b8";
    }

    const novoBarbeiroInput = document.getElementById("novoBarbeiro");
    const addBarbeiroBtn = document.getElementById("addBarbeiroBtn");
    if (novoBarbeiroInput && addBarbeiroBtn) {
        novoBarbeiroInput.disabled = limiteAtingido;
        addBarbeiroBtn.disabled = limiteAtingido;
        addBarbeiroBtn.textContent = limiteAtingido ? "Limite atingido" : "Adicionar";
    }

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
async function removeBarbeiro(index) {

    barbeiros.splice(index, 1);

    await syncBarbearia();
    renderBarbeiros();

}

function renderDashboard() {

    const hojeDate = new Date();

    const hoje = clientes.filter((cliente) => {
        const data = parseDate(cliente.horario);
        return data && isSameDay(data, hojeDate);
    }).length;

    const pendentes = clientes.filter(
        (cliente) => cliente.status !== "Concluído"
    ).length;

    const concluidos = clientes.filter(
        (cliente) => cliente.status === "Concluído"
    ).length;

    let faturamentoHoje = 0;
    let faturamentoMes = 0;
    let faturamentoSemana = 0;
    let totalValorConcluido = 0;

    const seteDiasAtras = new Date(hojeDate);
    seteDiasAtras.setDate(hojeDate.getDate() - 6);
    seteDiasAtras.setHours(0, 0, 0, 0);

    clientes.forEach((cliente) => {

        if (cliente.status !== "Concluído") return;

        const data = parseDate(cliente.horario);

        if (!data) return;

        const valor = Number(cliente.valor) || 0;
        totalValorConcluido += valor;

        if (isSameDay(data, hojeDate)) {
            faturamentoHoje += valor;
        }

        if (isSameMonth(data, hojeDate)) {
            faturamentoMes += valor;
        }

        if (data >= seteDiasAtras && data <= hojeDate) {
            faturamentoSemana += valor;
        }

    });

    const ticketMedio =
        concluidos > 0
            ? totalValorConcluido / concluidos
            : 0;

    document.getElementById("totalClientes").textContent =
        clientes.length;

    document.getElementById("agendamentosHoje").textContent =
        hoje;

    document.getElementById("pendentes").textContent =
        pendentes;

    document.getElementById("concluidos").textContent =
        concluidos;

    document.getElementById("faturamentoHoje").textContent =
        formatCurrency(faturamentoHoje);

    document.getElementById("faturamentoMes").textContent =
        formatCurrency(faturamentoMes);

    document.getElementById("faturamentoSemana").textContent =
        formatCurrency(faturamentoSemana);

    document.getElementById("ticketMedio").textContent =
        formatCurrency(ticketMedio);

}

function render() {
    const lista = document.getElementById("lista");
    const select = document.getElementById("clientes");

    lista.innerHTML = "";
    select.innerHTML = "";

    if (!clientes.length) {
        lista.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">Nenhum cliente cadastrado ainda.</td>
      </tr>
    `;
        select.innerHTML = `<option value="">Nenhum cliente</option>`;
        renderDashboard();
        renderFinanceiroBarbeiros();
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
    renderFinanceiroBarbeiros();
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
function renderFinanceiroBarbeiros() {

    const container =
        document.getElementById(
            "financeiroBarbeiros"
        );

    if (!container) return;

    let totais = {};

    clientes.forEach(cliente => {

        if (
            cliente.status !== "Concluído"
        ) return;

        const barbeiro =
            cliente.barbeiro || "Sem barbeiro";

        if (!totais[barbeiro]) {

            totais[barbeiro] = 0;

        }

        totais[barbeiro] += Number(
            cliente.valor || 0
        );

    });

    container.innerHTML = "";

    if (!Object.keys(totais).length) {
        container.innerHTML = `
            <div class="empty-state">Nenhum atendimento concluído ainda.</div>
        `;
        return;
    }

    Object.entries(totais)
        .sort((a, b) => b[1] - a[1])
        .forEach(([nome, total]) => {

            container.innerHTML += `

      <div class="card" style="margin-bottom:10px">

        <strong>
          👨‍🦱 ${nome}
        </strong>

        <h3>
          ${formatCurrency(total)}
        </h3>

      </div>

      `;

        });

}
function bootstrap() {
    const overlay = document.getElementById('sidebarOverlay');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const mainContent = document.querySelector('.main-content');

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

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    document.querySelectorAll('.menu-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.menu-item').forEach((menu) => {
                menu.classList.remove('active');
            });
            item.classList.add('active');
            switchView(item.dataset.view);
            closeSidebar();
        });
    });

    if (mainContent) {
        mainContent.addEventListener('click', (event) => {
            const target = event.target;
            const isMenuToggle = target.closest && target.closest('.menu-toggle');
            const isSidebar = target.closest && target.closest('.sidebar');
            const isOverlay = target.closest && target.closest('#sidebarOverlay');

            if (window.innerWidth <= 768 && !isMenuToggle && !isSidebar && !isOverlay) {
                closeSidebar();
            }
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });

    if (isFirebaseReady()) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                document.getElementById("userBadge").textContent = user.displayName || user.email;
                showAppScreen();
                loadClientesFromFirebase();
                loadBarbeariaFromFirebase();
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
function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar && overlay) {
        sidebar.classList.add('open');
        overlay.classList.remove('hidden');
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar && overlay) {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden');
    }
}

function renderPlano() {
    document.querySelectorAll(".plano-card").forEach((card) => {
        const plano = Number(card.dataset.plano);
        card.classList.toggle("plano-atual", plano === planoAtual);

        const btn = card.querySelector(".plano-btn");
        if (btn) {
            btn.textContent = plano === planoAtual ? "Plano atual" : (plano > planoAtual ? "Fazer upgrade" : "Mudar para este");
            btn.disabled = plano === planoAtual;
        }
    });
}

async function selecionarPlano(plano) {
    plano = Number(plano);

    if (plano === planoAtual) return;

    if (plano < planoAtual && barbeiros.length > PLANOS[plano].limite) {
        alert(`Você tem ${barbeiros.length} barbeiro(s) cadastrado(s). Remova até ${PLANOS[plano].limite} antes de mudar para o plano ${PLANOS[plano].nome}.`);
        return;
    }

    planoAtual = plano;
    await syncBarbearia();
    renderPlano();
    renderBarbeiros();
    alert(`Plano alterado para ${PLANOS[plano].nome}!`);
}

function switchView(view) {
    if (!view) return;

    document.querySelectorAll('.view-section').forEach((section) => {
        section.classList.add('hidden');
    });

    const target = document.getElementById(`view-${view}`);
    if (target) {
        target.classList.remove('hidden');
    }
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');

    if (!sidebar) return;

    if (sidebar.classList.contains('open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}
bootstrap();