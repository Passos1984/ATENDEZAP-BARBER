const EMAIL_ADMIN = "guilhermecpassos@hotmail.com";

const PRECOS_PLANOS = {
    1: 49.90, // Essencial
    2: 99.90, // Profissional
    3: 169.90 // Premium
};

// O LEÃO DE CHÁCARA
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        if (user.email === EMAIL_ADMIN) {
            document.getElementById("adminLoginScreen").style.display = "none";
            document.getElementById("adminDashboard").style.display = "block";
            carregarPainel();
        } else {
            firebase.auth().signOut().then(() => {
                alert("Acesso restrito a administradores. Você será desconectado.");
                window.location.href = "index.html"; 
            });
        }
    } else {
        document.getElementById("adminDashboard").style.display = "none";
        document.getElementById("adminLoginScreen").style.display = "flex";
    }
});

function fazerLoginAdmin() {
    const email = document.getElementById("adminEmail").value.trim();
    const senha = document.getElementById("adminPassword").value;
    const msgErro = document.getElementById("msgErro");

    if(!email || !senha) {
        msgErro.textContent = "Preencha e-mail e senha.";
        msgErro.style.display = "block";
        return;
    }

    firebase.auth().signInWithEmailAndPassword(email, senha)
        .catch(error => {
            msgErro.textContent = "E-mail ou senha incorretos.";
            msgErro.style.display = "block";
        });
}

function sairAdmin() {
    firebase.auth().signOut(); 
}

function carregarPainel() {
    db.collection("barbearias").onSnapshot((snapshot) => {
        const lista = document.getElementById("listaAdminClientes");
        lista.innerHTML = "";
        
        let total = 0;
        let pagantes = 0;
        let faturamentoReal = 0;

        snapshot.forEach((doc) => {
            const dados = doc.data();
            const id = doc.id;
            
            if(!dados.email) return;

            total++;
            
            const isPagante = dados.pagante || false;
            const planoAtual = dados.plano || 1; // Puxa o plano do banco, ou o 1 por padrão
            
            if (isPagante && dados.statusAcesso === "ativo") {
                pagantes++;
                faturamentoReal += PRECOS_PLANOS[planoAtual];
            }

            const statusClass = dados.statusAcesso === "ativo" ? "pill-ativo" : "pill-bloqueado";
            const textoStatus = dados.statusAcesso === "ativo" ? "Liberado" : "BLOQUEADO";
            
            const pillFinanceiro = isPagante 
                ? `<span class="pill pill-pagante">Pagante</span>` 
                : `<span class="pill pill-trial">Em Teste</span>`;

            // CAIXA DE SELEÇÃO DE PLANOS
            const seletorPlano = `
                <select onchange="alterarPlano('${id}', this.value)" style="background: rgba(0,0,0,0.2); color: #94a3b8; border: 1px solid #334155; border-radius: 4px; padding: 4px; margin-top: 5px; cursor: pointer;">
                    <option value="1" ${planoAtual == 1 ? 'selected' : ''}>Essencial (R$ 49,90)</option>
                    <option value="2" ${planoAtual == 2 ? 'selected' : ''}>Profissional (R$ 99,90)</option>
                    <option value="3" ${planoAtual == 3 ? 'selected' : ''}>Premium (R$ 169,90)</option>
                </select>
            `;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <strong style="font-size: 1.1rem; color: #fff;">${dados.nome || 'Sem Nome'}</strong><br>
                    <small style="color: #94a3b8;">${dados.email}</small><br>
                    ${seletorPlano}
                </td>
                
                <td>
                    <div style="margin-bottom: 8px;">${pillFinanceiro}</div>
                    <label class="switch-container">
                        <div class="switch">
                            <input type="checkbox" ${isPagante ? 'checked' : ''} onchange="alterarPagante('${id}', this.checked)">
                            <span class="slider"></span>
                        </div>
                        <small>Pago</small>
                    </label>
                </td>
                
                <td>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="date" id="vencimento-${id}" value="${dados.dataVencimento || ''}">
                        <button onclick="salvarVencimento('${id}')" class="btn-salvar" style="padding: 6px; border-radius: 4px;">OK</button>
                    </div>
                </td>
                
                <td>
                    <span class="pill ${statusClass}">${textoStatus}</span>
                </td>
                
                <td>
                    <div style="display: flex; flex-direction: column; gap: 5px; max-width: 120px;">
                        ${dados.statusAcesso === "bloqueado" 
                            ? `<button onclick="mudarStatus('${id}', 'ativo')" class="btn btn-liberar">Liberar</button>` 
                            : `<button onclick="mudarStatus('${id}', 'bloqueado')" class="btn btn-bloquear">Suspender</button>`
                        }
                        <button onclick="excluirBarbearia('${id}', '${dados.nome || 'este cliente'}')" class="btn btn-excluir">Excluir</button>
                    </div>
                </td>
            `;
            lista.appendChild(tr);
        });

        document.getElementById("totalClientes").textContent = total;
        document.getElementById("totalPagantes").textContent = pagantes;
        document.getElementById("faturamento").textContent = "R$ " + faturamentoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    });
}

// NOVA FUNÇÃO: Salvar mudança de plano no banco de dados
function alterarPlano(idUsuario, novoPlano) {
    db.collection("barbearias").doc(idUsuario).update({ 
        plano: parseInt(novoPlano) 
    }).then(() => {
        console.log("Plano atualizado com sucesso!");
    });
}

function alterarPagante(idUsuario, isChecked) {
    db.collection("barbearias").doc(idUsuario).update({ pagante: isChecked });
}

function mudarStatus(idUsuario, novoStatus) {
    if(confirm(`Mudar o acesso para ${novoStatus.toUpperCase()}?`)) {
        db.collection("barbearias").doc(idUsuario).update({ statusAcesso: novoStatus });
    }
}

function salvarVencimento(idUsuario) {
    const novaData = document.getElementById(`vencimento-${idUsuario}`).value;
    if(!novaData) return alert("Escolha uma data válida!");
    db.collection("barbearias").doc(idUsuario).update({ dataVencimento: novaData })
        .then(() => alert("Vencimento atualizado!"));
}

function excluirBarbearia(idUsuario, nome) {
    if(confirm(`⚠️ EXCLUIR DEFINITIVAMENTE a barbearia "${nome}"? Esta ação não pode ser desfeita.`)) {
        db.collection("barbearias").doc(idUsuario).delete();
    }
}