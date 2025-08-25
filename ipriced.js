/* ===== Persistência ===== */
const store = {
    get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)) }
};

/* ===== Estado ===== */
let ingredientes = store.get('Ingredientes', []); // {id, nome, preco, qtd, unit}
let receitas = store.get('Receitas', []);     // {id, nome, linhas[{ ingId, qtd, unit }], mao, margem, rendimento, custoIng, preco}
let encomendas = store.get('Encomendas', []);   // {id, nome, data, status, produtos[]}

/* ===== SPA ===== */
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.view).classList.add('active');
    });
});

/* ===== ENTER navegação ===== */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const focusables = Array.from(document.querySelectorAll('input,select,button.primary'))
            .filter(el => el.offsetParent !== null); // apenas visíveis
        const i = focusables.indexOf(document.activeElement);
        if (i > -1 && i < focusables.length - 1) { focusables[i + 1].focus(); e.preventDefault(); }
    }
});

/* ===== Helpers de unidade ===== */
const toBase = (q, u) => (u === 'kg' || u === 'L') ? q * 1000 : q; // g/ml/un base
const unitGroup = (u) => (u === 'g' || u === 'kg') ? 'massa' : (u === 'ml' || u === 'L') ? 'volume' : 'un';
const money = (n) => 'R$ ' + (n || 0).toFixed(2);

/* ===== Ingredientes ===== */
const $ingList = document.getElementById('lista-ingredientes');
function renderIngredientes() {
    $ingList.innerHTML = '';
    if (!ingredientes.length) { $ingList.innerHTML = '<div class="item"><small class="muted">Nenhum ingrediente cadastrado.</small></div>'; return; }
    ingredientes.forEach(i => {
        const baseFactor = (i.unit === 'kg' || i.unit === 'L') ? 1000 : 1;
        const baseUnit = i.unit === 'kg' ? 'g' : i.unit === 'L' ? 'ml' : i.unit;
        const unitValue = i.preco / (i.qtd * baseFactor);

        const el = document.createElement('div'); el.className = 'item';
        el.innerHTML = `
    <div>
        <strong>${i.nome}</strong><br />
        <small class="muted">${money(i.preco)} por ${i.qtd} ${i.unit}</small><br />
        <small>Valor unitário: <strong>${unitValue.toFixed(4)} / ${baseUnit}</strong></small>
    </div>
    <button class="delete" title="Excluir" aria-label="Excluir" onclick="removeIngrediente('${i.id}')">🗑️</button>
    `;
        $ingList.appendChild(el);
    });
}
window.removeIngrediente = (id) => {
    ingredientes = ingredientes.filter(x => x.id !== id);
    store.set('Ingredientes', ingredientes);
    renderIngredientes(); refreshIngredientOptions();
};
document.getElementById('btn-add-ing').addEventListener('click', () => {
    const nome = document.getElementById('ing-nome').value.trim();
    const preco = parseFloat((document.getElementById('ing-preco').value || '').replace(',', '.'));
    const qtd = parseFloat((document.getElementById('ing-qtd').value || '').replace(',', '.'));
    const unit = document.getElementById('ing-unit').value;
    if (!nome || !preco || !qtd || !unit) { alert('Preencha nome, preço, quantidade e unidade.'); return; }
    ingredientes.push({ id: crypto.randomUUID(), nome, preco, qtd, unit });
    store.set('Ingredientes', ingredientes);
    document.getElementById('ing-nome').value = '';
    document.getElementById('ing-preco').value = '';
    document.getElementById('ing-qtd').value = '';
    document.getElementById('ing-unit').value = '';
    renderIngredientes(); refreshIngredientOptions();
});
renderIngredientes();

/* ===== Receitas ===== */
const $rows = document.getElementById('rec-rows');
function makeRow() {
    const row = document.createElement('div'); row.className = 'inline';
    row.innerHTML = `
    <select class="select ing-select" style="flex:2"></select>
    <input class="input qty-input" type="number" step="0.01" placeholder="Ex.: 200" style="flex:1" />
    <select class="select unit-input" style="flex:1">
        <option value="" disabled selected>Un de medida</option>
        <option>g</option><option>ml</option><option>kg</option><option>L</option><option>un</option>
    </select>
    <button class="delete" title="Remover" onclick="this.parentElement.remove()">🗑️</button>
    `;
    $rows.appendChild(row);
    populateOneSelect(row.querySelector('.ing-select'));
}
function populateOneSelect(sel) {
    const current = sel.value || '';
    sel.innerHTML = `<option value="" disabled selected>Selecione</option>` + ingredientes.map(i => `<option value="${i.id}">${i.nome}</option>`).join('');
    if (current && Array.from(sel.options).some(o => o.value === current)) sel.value = current;
}
function refreshIngredientOptions() {
    document.querySelectorAll('.ing-select').forEach(populateOneSelect);
}
document.getElementById('btn-add-row').addEventListener('click', makeRow);

for (let i = 0; i < 4; i++) makeRow();

function calcular() {
    const mao = parseFloat((document.getElementById('rec-mao').value || '').replace(',', '.')) || 0;
    const margem = parseFloat((document.getElementById('rec-margem').value || '0').replace(',', '.')) || 0;
    const rendimento = parseFloat((document.getElementById('rec-rendimento').value || '').replace(',', '.'));
    let custoIng = 0;

    document.querySelectorAll('#rec-rows .inline').forEach(row => {
        const ingId = row.querySelector('.ing-select').value;
        const qtd = parseFloat((row.querySelector('.qty-input').value || '').replace(',', '.'));
        const u = row.querySelector('.unit-input').value;
        if (!ingId || !qtd || !u) return;
        const ing = ingredientes.find(x => x.id === ingId); if (!ing) return;
        if (unitGroup(ing.unit) !== unitGroup(u)) return; // g vs ml etc
        const custoBase = ing.preco / toBase(ing.qtd, ing.unit);
        custoIng += custoBase * toBase(qtd, u);
    });

    const custoTotal = custoIng + mao;
    const precoSugerido = custoTotal * (1 + margem / 100);
    const lucro = precoSugerido - custoTotal;

    // Se houver rendimento, calcula preço por unidade
    let precoPorUn = null;
    if (rendimento && rendimento > 0) precoPorUn = precoSugerido / rendimento;

    const nome = (document.getElementById('rec-nome').value || '—').trim() || '—';
    const box = document.getElementById('rec-resultado');
    box.style.display = 'block';
    box.innerHTML = `
    <div class="result-row"><span class="result-title">Receita</span><span>${nome}</span></div>
    <div class="result-row"><span>Custo ingredientes</span><span>${money(custoIng)}</span></div>
    <div class="result-row"><span>Mão de obra</span><span>${money(mao)}</span></div>
    <div class="result-row"><span>Margem aplicada</span><span>${margem.toFixed(0)}%</span></div>
    <div class="result-row"><span>Lucro estimado</span><span>${money(lucro)}</span></div>
    <div class="result-row" style="border-top:1px dashed #ddd;padding-top:8px"><span class="result-title">Preço sugerido</span><span class="result-title">${money(precoSugerido)}</span></div>
    ${(rendimento && rendimento > 0) ? `<div class="result-row"><span>Rendimento</span><span>${rendimento}</span></div>
    <div class="result-row"><span>Preço por unidade</span><span>${money(precoPorUn)}</span></div>` : ''}
    `;
    return { custoIng, mao, margem, rendimento: isNaN(rendimento) ? null : rendimento, precoSugerido };
}
document.getElementById('btn-calcular').addEventListener('click', calcular);

function salvarReceita() {
    const nome = document.getElementById('rec-nome').value.trim();
    if (!nome) { alert('Informe o nome da receita.'); return; }
    const res = calcular();
    // coletar linhas
    const linhas = [];
    document.querySelectorAll('#rec-rows .inline').forEach(row => {
        const ingId = row.querySelector('.ing-select').value;
        const qtd = row.querySelector('.qty-input').value.trim();
        const unit = row.querySelector('.unit-input').value;
        if (ingId && qtd && unit) linhas.push({ ingId, qtd, unit });
    });
    if (!linhas.length) { alert('Adicione ao menos um ingrediente.'); return; }
    const rec = {
        id: crypto.randomUUID(), nome,
        mao: res.mao, margem: res.margem, rendimento: res.rendimento,
        linhas, custoIng: res.custoIng, preco: res.precoSugerido
    };
    receitas.push(rec); store.set('Receitas', receitas);
    renderReceitas(); toast('Receita salva!');
}
document.getElementById('btn-salvar-receita').addEventListener('click', salvarReceita);

function renderReceitas() {
    const list = document.getElementById('lista-receitas'); list.innerHTML = '';
    if (!receitas.length) { list.innerHTML = '<div class="item"><small class="muted">Nenhuma receita salva.</small></div>'; return; }
    receitas.slice().reverse().forEach(r => {
        const div = document.createElement('div'); div.className = 'item';
        div.innerHTML = `
    <div>
        <strong>${r.nome}</strong><br />
        <small class="muted">Margem: ${r.margem}% ${r.rendimento ? `• Rendimento: ${r.rendimento}` : ''}</small><br />
        <small>Custo: ${money(r.custoIng)} &nbsp;|&nbsp; Preço: <strong>${money(r.preco)}</strong></small>
    </div>
    <button class="delete" title="Excluir receita" onclick="removeReceita('${r.id}')">🗑️</button>
    `;
        list.appendChild(div);
    });
}
window.removeReceita = (id) => {
    receitas = receitas.filter(x => x.id !== id);
    store.set('Receitas', receitas);
    renderReceitas();
};
renderReceitas();

/* Refresh selects quando ingredientes mudam */
function refreshIngredientOptions() {
    document.querySelectorAll('.ing-select').forEach(populateOneSelect);
}

/* ===== Encomendas ===== */
const $prodList = document.getElementById('produtos-encomenda');
function addProdutoRow(val = '') {
    const row = document.createElement('div'); row.className = 'inline';
    row.innerHTML = `<input class="input" placeholder="Produto encomendado" value="${val.replaceAll('"', '&quot;')}" />
    <button class="delete" title="Remover produto" onclick="this.parentElement.remove()">🗑️</button>`;
    $prodList.appendChild(row);
}
document.getElementById('btn-add-prod').addEventListener('click', () => addProdutoRow());
addProdutoRow();

document.getElementById('btn-add-enc').addEventListener('click', () => {
    const nome = document.getElementById('enc-nome').value.trim();
    const data = document.getElementById('enc-data').value;
    const produtos = Array.from($prodList.querySelectorAll('input')).map(i => i.value.trim()).filter(Boolean);
    if (!nome || !data || !produtos.length) { alert('Preencha cliente, data e ao menos um produto.'); return; }
    encomendas.push({ id: crypto.randomUUID(), nome, data, status: 'Em andamento', produtos });
    store.set('Encomendas', encomendas);
    renderEncomendas(); toast('Encomenda adicionada!');
    document.getElementById('enc-nome').value = ''; document.getElementById('enc-data').value = '';
    $prodList.innerHTML = ''; addProdutoRow();
});

function renderEncomendas() {
    const list = document.getElementById('lista-encomendas'); list.innerHTML = '';
    if (!encomendas.length) { list.innerHTML = '<div class="item"><small class="muted">Sem encomendas.</small></div>'; return; }
    encomendas.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(e => {
        const div = document.createElement('div'); div.className = 'item';
        const fmt = e.data ? new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
        div.innerHTML = `
    <div>
        <strong>${fmt}</strong> — ${e.nome}<br />
        <small class="muted">Produtos: ${e.produtos.join(', ')}</small><br />
        <small>Status: </small>
        <select class="select" style="margin-top:6px" onchange="updateStatus('${e.id}', this.value)">
            <option ${e.status === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
            <option ${e.status === 'Em preparo' ? 'selected' : ''}>Em preparo</option>
            <option ${e.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
    </div>
    <button class="delete" title="Excluir pedido" onclick="removeEncomenda('${e.id}')">🗑️</button>
    `;
        list.appendChild(div);
    });
}
window.updateStatus = (id, val) => {
    const item = encomendas.find(x => x.id === id); if (item) { item.status = val; store.set('Encomendas', encomendas); }
};
window.removeEncomenda = (id) => {
    encomendas = encomendas.filter(x => x.id !== id);
    store.set('Encomendas', encomendas);
    renderEncomendas();
};
renderEncomendas();

/* ===== Conversor Básico ===== */
document.getElementById('btn-conv-basico').addEventListener('click', () => {
    const val = parseFloat((document.getElementById('conv-val').value || '').replace(',', '.'));
    const from = document.getElementById('conv-from').value;
    const to = document.getElementById('conv-to').value;
    const out = document.getElementById('conv-res-basico');
    if (!val || !from || !to) { alert('Preencha valor e unidades.'); return; }

    // regras: massa<->massa, volume<->volume, un->un
    const gf = (u) => (u === 'g' || u === 'kg') ? 'massa' : (u === 'ml' || u === 'L') ? 'volume' : 'un';
    if (gf(from) !== gf(to)) { out.style.display = 'block'; out.innerHTML = '<div class="result-row"><span>Conversão inválida</span><span>Tipos diferentes</span></div>'; return; }

    // normaliza para base
    let base = val;
    if (from === 'kg') base = val * 1000;
    if (from === 'L') base = val * 1000;

    // converte base -> destino
    let res = base;
    if (to === 'kg') res = base / 1000;
    if (to === 'L') res = base / 1000;

    out.style.display = 'block';
    out.innerHTML = `<div class="result-row"><span>Resultado</span><span><strong>${res.toLocaleString('pt-BR')}</strong> ${to}</span></div>`;
});

/* ===== Conversor Culinário ===== */
const culMap = {

    cup_sugar: { to: 'g', factor: 200 },   // 1 xícara de açúcar ≈ 200 g
    cup_flour: { to: 'g', factor: 120 },   // 1 xícara de farinha ≈ 120 g
    tbsp: { to: 'ml', factor: 15 },   // 1 colher de sopa ≈ 15 ml
    tsp: { to: 'ml', factor: 5 },    // 1 colher de chá ≈ 5 ml
    egg: { to: 'g', factor: 50 },    // 1 ovo médio ≈ 50 g
};
document.getElementById('btn-conv-cul').addEventListener('click', () => {
    const val = parseFloat((document.getElementById('cul-val').value || '').replace(',', '.'));
    const from = document.getElementById('cul-from').value;
    const to = document.getElementById('cul-to').value;
    const out = document.getElementById('conv-res-cul');
    if (!val || !from || !to) { alert('Preencha quantidade e seleções.'); return; }

    const rule = culMap[from];
    if (!rule) { out.style.display = 'block'; out.textContent = 'Selecione uma medida válida.'; return; }

    // converte da medida culinária para unidade alvo intermediária (rule.to)
    let baseVal = val * rule.factor; // em rule.to
    // se destino é diferente da unidade padrão, converter (g<->kg / ml<->L / un permanece)
    let result = baseVal;
    if (rule.to === 'g') {
        if (to === 'kg') result = baseVal / 1000;
        else if (to === 'g') result = baseVal;
        else if (to === 'un') result = baseVal; // sem sentido, mas deixamos como valor bruto
        else if (to === 'ml' || to === 'L') { out.style.display = 'block'; out.innerHTML = '<div class="result-row"><span>Conversão</span><span>Use massa → volume com densidade específica</span></div>'; return; }
    } else if (rule.to === 'ml') {
        if (to === 'L') result = baseVal / 1000;
        else if (to === 'ml') result = baseVal;
        else if (to === 'un') result = baseVal; // idem
        else if (to === 'g' || to === 'kg') { out.style.display = 'block'; out.innerHTML = '<div class="result-row"><span>Conversão</span><span>Use volume → massa com densidade específica</span></div>'; return; }
    } else if (rule.to === 'un') {
        if (to === 'un') result = baseVal;
        else { out.style.display = 'block'; out.innerHTML = '<div class="result-row"><span>Conversão</span><span>Unidade → outra requer equivalência</span></div>'; return; }
    }

    out.style.display = 'block';
    out.innerHTML = `
    <div class="result-row"><span>Resultado</span><span><strong>${result.toLocaleString('pt-BR')}</strong> ${to}</span></div>
    <div class="result-row"><small class="muted">Obs.: Conversões culinárias são aproximações.</small><span></span></div>
    `;
});

/* ===== Inicialização dependente de storage ===== */
function init() {
    renderIngredientes(); refreshIngredientOptions();
    renderReceitas(); renderEncomendas();
}
init();

/* ===== Toast simples ===== */
function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
        position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)',
        background: 'rgba(20,16,80,.92)', color: '#fff', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', zIndex: 9999
    });
    document.body.appendChild(t); setTimeout(() => t.remove(), 1600);
}
