let fotos = [];
let dadosUsuario = {};
let valorDisponivel = 0;
let pastaId = null;

// =============== FUNÇÕES AUXILIARES ===============
function formatarData(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
}

function nomePastaPeriodo() {
    // Nome fixo para o período, EX: "Joao_19-05-2024_ate_25-05-2024"
    return `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}_ate_${formatarData(dadosUsuario.dataFim).replace(/\//g, '-')}`;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function atualizarTotais() {
    let totais = { cafe: 0, almoco: 0, jantar: 0, lavanderia: 0, geral: 0 };
    fotos.forEach(foto => {
        const valor = parseFloat(foto.valor);
        switch (foto.categoria) {
            case 'Café': totais.cafe += valor; break;
            case 'Almoço': totais.almoco += valor; break;
            case 'Jantar': totais.jantar += valor; break;
            case 'Lavanderia': totais.lavanderia += valor; break;
        }
        totais.geral += valor;
    });
    document.getElementById('totalCafe').textContent = formatarMoeda(totais.cafe);
    document.getElementById('totalAlmoco').textContent = formatarMoeda(totais.almoco);
    document.getElementById('totalJanta').textContent = formatarMoeda(totais.jantar);
    document.getElementById('totalLavanderia').textContent = formatarMoeda(totais.lavanderia);
    document.getElementById('totalGeral').textContent = formatarMoeda(totais.geral);
    atualizarSaldoDisponivel(valorDisponivel - totais.geral);
}

function atualizarPreview() {
    const container = document.getElementById('listaFotos');
    container.innerHTML = '';
    fotos.forEach(foto => {
        if (foto.arquivo) {
            const div = document.createElement('div');
            div.className = 'photo-preview';
            div.innerHTML = `
                <img src="${foto.preview}" alt="Comprovante">
                <div class="photo-info">
                    ${foto.categoria} - ${formatarData(foto.data)}<br>
                    ${formatarMoeda(foto.valor)}
                </div>
            `;
            container.appendChild(div);
        }
    });
}

function atualizarSaldoDisponivel(valor) {
    const saldoInfo = document.getElementById('saldoInfo');
    saldoInfo.innerHTML = `Saldo disponível: ${formatarMoeda(valor)}`;
    saldoInfo.style.backgroundColor = valor <= valorDisponivel * 0.2 ? '#ffebee' :
        valor <= valorDisponivel * 0.5 ? '#fff8e1' : '#e8f5e9';
    saldoInfo.style.color = valor <= valorDisponivel * 0.2 ? '#c62828' :
        valor <= valorDisponivel * 0.5 ? '#ff8f00' : '#388e3c';
}

// =============== PERSISTÊNCIA LOCAL ===============
function salvarDadosLocalStorage() {
    localStorage.setItem('viagemAtual', JSON.stringify({
        dadosUsuario,
        valorDisponivel,
        fotos: fotos.map(f => ({
            ...f,
            arquivo: null,
            preview: ''
        }))
    }));
}

function carregarDadosLocalStorage() {
    const saved = localStorage.getItem('viagemAtual');
    if (saved) {
        const { dadosUsuario: dados, valorDisponivel: valor, fotos: savedFotos } = JSON.parse(saved);
        dadosUsuario = dados;
        valorDisponivel = valor;
        fotos = savedFotos;
        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        atualizarSaldoDisponivel(valorDisponivel);
        atualizarPreview();
        atualizarTotais();
    }
}

// =============== ONEDRIVE (PASTA ÚNICA E HISTÓRICO) ===============
async function criarOuObterPasta(accessToken) {
    const pastaNome = nomePastaPeriodo();
    let response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${pastaNome}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (response.status === 200) return await response.json();
    response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: pastaNome,
            folder: {},
            "@microsoft.graph.conflictBehavior": "rename"
        })
    });
    return await response.json();
}

// Salva histórico na pasta do período no OneDrive
async function salvarHistoricoNoOneDrive(accessToken, pastaId) {
    const historico = {
        dadosUsuario,
        valorDisponivel,
        fotos: fotos.map(f => ({
            categoria: f.categoria,
            data: f.data,
            valor: f.valor,
            nomeArquivo: f.nomeArquivo
        }))
    };
    const blob = new Blob([JSON.stringify(historico)], { type: 'application/json' });
    await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/historico.json:/content`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: blob
    });
}

// Carrega histórico da pasta do período no OneDrive
async function carregarHistoricoDoOneDrive(accessToken, pastaId) {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/historico.json:/content`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (response.ok) {
        return await response.json();
    }
    return null;
}

// =============== EVENTOS PRINCIPAIS ===============
document.addEventListener('DOMContentLoaded', () => {
    carregarDadosLocalStorage();

    document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
        e.preventDefault();
        dadosUsuario = {
            nome: this.nome.value.trim(),
            dataInicio: this.dataInicio.value,
            dataFim: this.dataFim.value
        };
        valorDisponivel = parseFloat(this.valorDisponivel.value) || 0;
        document.getElementById('dataRegistro').min = dadosUsuario.dataInicio;
        document.getElementById('dataRegistro').max = dadosUsuario.dataFim;
        document.getElementById('dataRegistro').value = new Date().toISOString().split('T')[0];
        this.style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        salvarDadosLocalStorage();
    });

    document.getElementById('adicionarFotoBtn').addEventListener('click', () => {
        const files = document.getElementById('inputFoto').files;
        const valor = document.getElementById('valorGasto').value;
        const data = document.getElementById('dataRegistro').value;
        if (!data || !valor || files.length === 0) {
            alert('Preencha todos os campos!');
            return;
        }
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                fotos.push({
                    arquivo: file,
                    preview: e.target.result,
                    categoria: document.getElementById('legenda').value,
                    data: data,
                    valor: valor,
                    nomeArquivo: `${dadosUsuario.nome}_${Date.now()}_${file.name}`
                });
                atualizarPreview();
                atualizarTotais();
                salvarDadosLocalStorage();
            };
            reader.readAsDataURL(file);
        });
        document.getElementById('inputFoto').value = '';
        document.getElementById('valorGasto').value = '';
    });

    document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
        const fotosParaEnviar = fotos.filter(f => f.arquivo);
        if (fotosParaEnviar.length === 0) {
            alert('Adicione comprovantes primeiro!');
            return;
        }
        const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121'; // Seu Client ID
        const redirectUri = 'https://meuappcontas.netlify.app'; // Seu domínio
        const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
        const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');
        window.addEventListener('message', async function handler(e) {
            if (e.origin === window.location.origin && e.data.access_token) {
                window.removeEventListener('message', handler);
                try {
                    const accessToken = e.data.access_token;
                    // 1. Criar/obter pasta única
                    const pasta = await criarOuObterPasta(accessToken);
                    pastaId = pasta.id;
                    // 2. Enviar arquivos
                    for (const foto of fotosParaEnviar) {
                        await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/${foto.nomeArquivo}:/content`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            body: foto.arquivo
                        });
                    }
                    // 3. Salvar histórico
                    await salvarHistoricoNoOneDrive(accessToken, pastaId);
                    // 4. Remove apenas arquivos enviados (mantém histórico)
                    fotos = fotos.map(f => f.arquivo ? { ...f, arquivo: null, preview: '' } : f);
                    salvarDadosLocalStorage();
                    atualizarPreview();
                    alert('Arquivos enviados com sucesso!');
                    window.open(pasta.webUrl, '_blank');
                    authWindow.close();
                } catch (error) {
                    alert('Erro ao salvar: ' + error.message);
                    authWindow.close();
                }
            }
        });
    });

    // Exportação Excel/PDF
    document.getElementById('btnExportExcel').addEventListener('click', () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(fotos.map(f => ({
            Categoria: f.categoria,
            Data: formatarData(f.data),
            Valor: f.valor
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
        XLSX.writeFile(wb, 'gastos.xlsx');
    });

    document.getElementById('btnExportPDF').addEventListener('click', () => {
        const doc = new window.jspdf.jsPDF();
        doc.text('Relatório de Gastos', 10, 10);
        fotos.forEach((foto, i) => {
            doc.text(`${foto.categoria} - ${formatarData(foto.data)} - ${formatarMoeda(foto.valor)}`, 10, 20 + (i * 10));
        });
        doc.save('gastos.pdf');
    });

    document.getElementById('btnVoltar').addEventListener('click', () => {
        document.getElementById('areaFotos').style.display = 'none';
        document.getElementById('formIdentificacao').style.display = 'block';
        localStorage.removeItem('viagemAtual');
    });
});

// Ao acessar de outro dispositivo, após autenticar, buscar o histórico:
async function buscarHistoricoAoEntrar(accessToken) {
    const pasta = await criarOuObterPasta(accessToken);
    const historico = await carregarHistoricoDoOneDrive(accessToken, pasta.id);
    if (historico) {
        dadosUsuario = historico.dadosUsuario;
        valorDisponivel = historico.valorDisponivel;
        fotos = historico.fotos.map(f => ({ ...f, arquivo: null, preview: '' }));
        atualizarTotais();
        atualizarPreview();
        atualizarSaldoDisponivel(valorDisponivel - fotos.reduce((soma, f) => soma + parseFloat(f.valor), 0));
    }
}

// Para receber o token do OneDrive
if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substr(1));
    const token = params.get('access_token');
    if (token && window.opener) {
        window.opener.postMessage({ access_token: token }, window.location.origin);
        window.close();
    }
}
