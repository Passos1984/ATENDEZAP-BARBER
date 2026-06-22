// O E-mail do Chefe (Acesso exclusivo)
const EMAIL_ADMIN = "guilhermecpassos@hotmail.com";

// 1. Proteção da Página: Só você entra!
auth.onAuthStateChanged(user => {
    if (user) {
        if (user.email === EMAIL_ADMIN) {
            // Se for o dono, carrega a lista
            carregarPainel();
        } else {
            // Se for algum cliente abelhudo
            alert("Acesso negado. Redirecionando para o aplicativo...");
            window.location.href = "index.html";
        }
    } else {
        // Se ninguém estiver logado
        window.location.href = "index.html";
    }
});

// 2. Carregar Lista de Barbearias
function carregarPainel() {
    // CORREÇÃO: Agora lendo da coleção correta "barbearias"
    db.collection("barbearias").onSnapshot((snapshot) => {
        const lista = document.getElementById("listaAdminClientes");
        lista.innerHTML = "";
        
        let total = 0;
        let ativos = 0;

        snapshot.forEach((doc) => {
            const dados = doc.data();
            const id = doc.id;
            
            // Ignora se for um documento vazio ou sem e-mail para não quebrar a tabela
            if(!dados.email) return;

            total++;
            
            if (dados.statusAcesso === "ativo") ativos++;

            // Define cor e texto do status
            const statusClass = dados.statusAcesso === "ativo" ? "status-ativo" : "status-bloqueado";
            const textoStatus = dados.statusAcesso === "ativo" ? "ATIVO" : "BLOQUEADO";

            // Monta a linha da tabela (CORREÇÃO: alterado de dados.nomeBarbearia para dados.nome)
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="padding: 1rem; border-bottom: 1px solid #2a2a4a;">
                    <strong>${dados.nome || 'Sem Nome'}</strong><br>
                    <small style="color: #888;">${dados.email}</small>
                </td>
                <td style="padding: 1rem; border-bottom: 1px solid #2a2a4a;">
                    <input type="date" id="vencimento-${id}" value="${dados.dataVencimento || ''}" 
                           style="background: transparent; color: white; border: 1px solid #444; padding: 5px; border-radius: 4px;">
                    <button onclick="salvarVencimento('${id}')" class="btn-acao" style="background: #555; color: white; margin-left: 5px;">Salvar</button>
                </td>
                <td style="padding: 1rem; border-bottom: 1px solid #2a2a4a;" class="${statusClass}">
                    ${textoStatus}
                </td>
                <td style="padding: 1rem; border-bottom: 1px solid #2a2a4a;">
                    <button onclick="mudarStatus('${id}', 'ativo')" class="btn-acao btn-liberar">Liberar</button>
                    <button onclick="mudarStatus('${id}', 'bloqueado')" class="btn-acao btn-bloquear" style="margin-left: 5px;">Bloquear</button>
                </td>
            `;
            lista.appendChild(tr);
        });

        // Atualiza os cards coloridos no topo
        document.getElementById("totalClientes").textContent = total;
        document.getElementById("totalAtivos").textContent = ativos;
        
        // Faturamento Simulado (Calculado em R$ 497)
        const faturamento = ativos * 497;
        document.getElementById("faturamento").textContent = "R$ " + faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    });
}

// 3. Funções de Ação (Aprovar / Bloquear)
function mudarStatus(idUsuario, novoStatus) {
    if(confirm(`Tem certeza que deseja mudar o status para ${novoStatus.toUpperCase()}?`)) {
        // CORREÇÃO: Atualizando o status na coleção "barbearias"
        db.collection("barbearias").doc(idUsuario).update({
            statusAcesso: novoStatus
        }).then(() => {
            console.log("Status atualizado!");
        }).catch(erro => {
            console.error("Erro ao atualizar status: ", erro);
            alert("Erro ao mudar status. Verifique as regras do Firebase.");
        });
    }
}

function salvarVencimento(idUsuario) {
    const novaData = document.getElementById(`vencimento-${idUsuario}`).value;
    if(!novaData) {
        alert("Escolha uma data válida!");
        return;
    }

    // CORREÇÃO: Atualizando a data na coleção "barbearias"
    db.collection("barbearias").doc(idUsuario).update({
        dataVencimento: novaData
    }).then(() => {
        alert("Vencimento atualizado!");
    }).catch(erro => {
        console.error("Erro ao atualizar data: ", erro);
    });
}

// 4. Botão de Sair
function sairAdmin() {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    });
}