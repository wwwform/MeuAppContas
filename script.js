let fotos = [];
let dadosUsuario = {};
let saldoDisponivel = 0;
let pastaId = null; // ID da pasta da viagem no OneDrive

// =============== FUNÇÕES AUXILIARES ===============
function formatarData(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor || 0);
}

function atualizarTotais() {
    let totais = {
        cafe: 0,
        almoco: 0,
        jantar: 0,
        lavanderia: 0,
        geral: 0
    };

    fotos.forEach(foto => {
        const valor = parseFloat(foto.valor);
        switch(foto.categoria) {
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

    atualizarSaldoDisponivel(saldoDisponivel - totais.geral);
}

function atualizarPreview() {
    const container = document.getElementById('listaFotos');
    container.innerHTML = '';

    fotos.forEach(foto => {
        const div = document.createElement('div');
        div.className = 'photo-preview';
        div.innerHTML = `
            <img src="${foto.preview}" alt="Comprovante">
            <div class="photo-info">
                ${foto.categoria}<br>
                ${formatarData(foto.data)}<br>
                ${formatarMoeda(foto.valor)}
            </div>
        `;
        container.appendChild(div);
    });
}

function atualizarSaldoDisponivel(valorAtual) {
    saldoDisponivel = valorAtual;
    if (saldoDisponivel < 0) saldoDisponivel = 0;
    let el = document.getElementById('saldoDisponivel');
    if (!el) {
        el = document.createElement('div');
        el.id = 'saldoDisponivel';
        el.style = "font-size:18px;font-weight:bold;margin-bottom:20px;color:#388e3c;text-align:center;";
        document.querySelector('.container').insertBefore(el, document.getElementById('areaFotos'));
    }
    el.innerHTML = `Saldo disponível: <span>${formatarMoeda(saldoDisponivel)}</span>`;
}

// =============== EXPORTAÇÃO ===============
function exportarParaExcel() {
    const wb = XLSX.utils.book_new();
    const ws_data = [['Categoria', 'Data', 'Valor']];
    fotos.forEach(foto => {
        ws_data.push([foto.categoria, formatarData(foto.data), foto.valor]);
    });
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, 'gastos_viagem.xlsx');
}

function exportarParaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Relatório de Gastos de Viagem', 10, 10);
    let y = 20;
    fotos.forEach(foto => {
        doc.text(`${foto.categoria} - ${formatarData(foto.data)} - ${formatarMoeda(foto.valor)}`, 10, y);
        y += 10;
    });
    doc.save('gastos_viagem.pdf');
}

// =============== HISTÓRICO NO ONEDRIVE ===============
async function salvarHistoricoOneDrive(accessToken, pastaId) {
    const historico = {
        dadosUsuario,
        saldoDisponivel,
        fotos: fotos.map(f => ({
            categoria: f.categoria,
            data: f.data,
            valor: f.valor,
            nomeArquivo: f.nomeArquivo
        }))
    };
    const blob = new Blob([JSON.stringify(historico)], { type: 'application/json' });
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/historico.json:/content`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: blob
    });
    if (!response.ok) throw new Error('Erro ao salvar histórico no OneDrive');
}

async function carregarHistoricoOneDrive(accessToken, pastaId) {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/historico.json:/content`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Erro ao carregar histórico do OneDrive');
    }
    return await response.json();
}

// =============== EVENTOS PRINCIPAIS ===============
document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
    e.preventDefault();

    dadosUsuario = {
        nome: document.getElementById('nome').value.trim(),
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value
    };

    // Pergunta o saldo inicial
    let valorInicial = prompt("Qual o valor disponível para gastar na viagem? (R$)", "0");
    valorInicial = parseFloat(valorInicial) || 0;
    atualizarSaldoDisponivel(valorInicial);

    // Configurar datas
    const dataRegistro = document.getElementById('dataRegistro');
    dataRegistro.min = dadosUsuario.dataInicio;
    dataRegistro.max = dadosUsuario.dataFim;
    dataRegistro.value = new Date().toISOString().split('T')[0];

    document.getElementById('formIdentificacao').style.display = 'none';
    document.getElementById('areaFotos').style.display = 'block';
});

document.getElementById('adicionarFotoBtn').addEventListener('click', function() {
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
                nomeArquivo: `${dadosUsuario.nome.replace(/ /g, '_')}_${formatarData(data).replace(/\//g, '-')}_${Date.now()}.${file.name.split('.').pop()}`
            });
            atualizarPreview();
            atualizarTotais();
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('inputFoto').value = '';
    document.getElementById('valorGasto').value = '';
});

// =============== INTEGRAÇÃO ONEDRIVE ===============
document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
    if (fotos.length === 0) {
        alert('Adicione comprovantes primeiro!');
        return;
    }

    const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121'; // Substitua pelo seu Client ID do Azure
    const redirectUri = 'https://meuappcontas.netlify.app/'; // Substitua pelo seu domínio exato

    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');

    window.addEventListener('message', async function handler(e) {
        if (e.origin === window.location.origin && e.data.access_token) {
            window.removeEventListener('message', handler);
            const accessToken = e.data.access_token;

            try {
                // Nome padrão da pasta (sempre a mesma para o usuário)
                const pasta = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
                // Cria ou obtém a pasta
                const folderData = {
                    "name": pasta,
                    "folder": {},
                    "@microsoft.graph.conflictBehavior": "rename"
                };
                const createFolderResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(folderData)
                });
                if (!createFolderResponse.ok) throw new Error('Erro ao criar pasta');
                const folderInfo = await createFolderResponse.json();
                pastaId = folderInfo.id;

                // Salva histórico completo
                await salvarHistoricoOneDrive(accessToken, pastaId);

                // Upload dos arquivos
                for (const foto of fotos) {
                    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/${foto.nomeArquivo}:/content`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${accessToken}` },
                        body: foto.arquivo
                    });
                    if (!response.ok) throw new Error(`Erro ao enviar arquivo ${foto.nomeArquivo}`);
                }

                alert(`Arquivos e histórico salvos com sucesso na pasta "${pasta}"!`);
                window.open('https://onedrive.live.com/', '_blank');
                authWindow.close();
                // Não limpa fotos, pois histórico está salvo
            } catch (error) {
                alert('Erro ao salvar arquivos: ' + error.message);
                console.error('Erro completo:', error);
            }
        }
    });
});

// =============== EXPORTAÇÃO (BOTÕES) ===============
window.addEventListener('DOMContentLoaded', () => {
    // Adiciona botões de exportação na interface
    const exportDiv = document.createElement('div');
    exportDiv.style = "display:flex; gap:10px; justify-content:center; margin:20px 0";
    exportDiv.innerHTML = `
        <button class="btn-secondary" id="btnExportExcel" type="button">Exportar Excel</button>
        <button class="btn-secondary" id="btnExportPDF" type="button">Exportar PDF</button>
    `;
    document.querySelector('.container').appendChild(exportDiv);

    document.getElementById('btnExportExcel').onclick = exportarParaExcel;
    document.getElementById('btnExportPDF').onclick = exportarParaPDF;
});

// =============== CARREGAR HISTÓRICO AO LOGAR ===============
async function tentarCarregarHistorico(accessToken, pasta) {
    try {
        // Busca pasta pelo nome
        const pastaResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${pasta}'`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const pastaJson = await pastaResponse.json();
        if (pastaJson.value && pastaJson.value.length > 0) {
            pastaId = pastaJson.value[0].id;
            const historico = await carregarHistoricoOneDrive(accessToken, pastaId);
            if (historico) {
                dadosUsuario = historico.dadosUsuario;
                saldoDisponivel = historico.saldoDisponivel;
                fotos = historico.fotos.map(f => ({ ...f, preview: '', arquivo: null }));
                atualizarPreview();
                atualizarTotais();
                atualizarSaldoDisponivel(saldoDisponivel);
                alert('Histórico carregado do OneDrive!');
            }
        }
    } catch (err) {
        // Se não existir, apenas ignora
    }
}

// =============== CAPTURA TOKEN APÓS AUTENTICAÇÃO ===============
if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substr(1));
    const token = params.get('access_token');
    if (token && window.opener) {
        // Carrega histórico se possível
        const pasta = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
        window.opener.tentarCarregarHistorico(token, pasta);
        window.opener.postMessage({ access_token: token }, window.location.origin);
        window.close();
    }
}
