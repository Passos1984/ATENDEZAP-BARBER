let clientes = JSON.parse(localStorage.getItem("barber")) || [];

// salvar cliente
function addClient() {
  let nome = document.getElementById("nome").value;
  let tel = document.getElementById("tel").value;
  let servico = document.getElementById("servico").value;
  let horario = document.getElementById("horario").value;

  if (!nome || !tel) return;

  clientes.push({ nome, tel, servico, horario });

  localStorage.setItem("barber", JSON.stringify(clientes));

  document.getElementById("nome").value = "";
  document.getElementById("tel").value = "";
  document.getElementById("servico").value = "";
  document.getElementById("horario").value = "";

  render();
}

// render
function render() {
  let lista = document.getElementById("lista");
  let select = document.getElementById("clientes");

  lista.innerHTML = "";
  select.innerHTML = "";

  clientes.forEach((c, i) => {
    lista.innerHTML += `
      <div class="cliente">
        <b>${c.nome}</b><br>
        ${c.tel}<br>
        ${c.servico} - ${c.horario}
      </div>
    `;

    select.innerHTML += `<option value="${i}">${c.nome}</option>`;
  });
}

// WhatsApp
function sendWhats() {
  let i = document.getElementById("clientes").value;
  let c = clientes[i];

  let text = document.getElementById("msg").value;

  let url = `https://wa.me/55${c.tel}?text=${encodeURIComponent(text)}`;

  window.open(url, "_blank");
}

render();